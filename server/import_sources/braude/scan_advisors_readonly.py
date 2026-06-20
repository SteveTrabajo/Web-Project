#!/usr/bin/env python3
"""Read-only scan for academic advisor candidates in local Braude import sources."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from docx import Document

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT = SCRIPT_DIR / "advisors-preview.json"

KEYWORDS = (
    "יועץ", "יועצת", "advisor", "מרצה אחראי", "רכז", "רכזת", "ראש מסלול",
    "הנחיות כלליות", "פירוט היועצים",
)
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ALPHA_RANGE_RE = re.compile(
    r"\(([א-ת])\s*(?:עד|[-–])\s*([א-ת])'?\)"
    r"|([א-ת])\s*[-–]\s*([א-ת])"
)


def norm(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s).replace("\u00A0", " ")).strip()


def extract_alpha_range(text: str) -> str | None:
    m = ALPHA_RANGE_RE.search(text)
    if not m:
        return None
    if m.group(1) and m.group(2):
        return f"{m.group(1)}-{m.group(2)}"
    if m.group(3) and m.group(4):
        return f"{m.group(3)}-{m.group(4)}"
    return None


def scan_docx_paragraphs(path: Path) -> list[dict]:
    doc = Document(str(path))
    rows = []
    for i, para in enumerate(doc.paragraphs):
        t = norm(para.text)
        if not t:
            continue
        has_kw = any(k in t for k in KEYWORDS)
        emails = EMAIL_RE.findall(t)
        alpha = extract_alpha_range(t)
        if has_kw or emails:
            rows.append({
                "file": path.relative_to(SCRIPT_DIR).as_posix(),
                "paragraphIndex": i,
                "text": t,
                "emails": emails,
                "keywordMatches": [k for k in KEYWORDS if k in t],
                "lastNameRange": alpha,
            })
    return rows


def classify_row(row: dict) -> dict:
    text = row["text"]
    emails = row.get("emails") or []
    alpha = row.get("lastNameRange")

    category = "other"
    notes = []

    if "פירוט היועצים" in text or "הנחיות כלליות" in text:
        category = "reference_missing_file"
        notes.append("Points to external 'הנחיות כלליות' file — not in import_sources")
    elif "יועץ" in text or "יועצת" in text:
        if emails:
            category = "possible_advisor_with_email"
        else:
            category = "generic_advisor_mention"
            notes.append("Mentions advisor but no email/name structure")
    elif emails and alpha and re.search(r"(דר['\"]|פרופ|גב['\"])", text):
        if "מסלול" in text and "יועץ" not in text:
            category = "track_coordinator_not_advisor"
            notes.append("Track/specialization coordinator — not academic advisor")
        else:
            category = "probable_advisor_contact_line"
            notes.append("Name + email + letter range in parentheses — likely advisor contact")
    elif "מלווה" in text or "מנטור" in text:
        category = "mentor_not_advisor"
    elif "פטור" in text or "חריג" in text:
        category = "exemptions_contact"
    elif "רמ\"ח" in text or "מזכירות" in text or "רישום ממוחשב" in text:
        category = "registration_support"
    elif emails and "מסלול" in text:
        category = "track_coordinator_not_advisor"
        notes.append("Specialization track coordinator — not academic advisor")
    elif emails:
        category = "email_contact_unclear"
    elif "רכז" in text and not emails:
        category = "false_positive_keyword"
        notes.append("'רכז' matched inside unrelated word (e.g. במרכז)")

    return {**row, "category": category, "notes": notes}


def split_multi_advisor_line(row: dict) -> list[dict]:
    """Split combined lines like sammar/klas into separate candidate records."""
    text = row["text"]
    emails = row.get("emails") or []
    if len(emails) <= 1:
        return [row]

    parts = re.split(r"\s*/\s*", text)
    out = []
    for part in parts:
        part_emails = EMAIL_RE.findall(part)
        if not part_emails:
            continue
        out.append({
            **row,
            "text": part.strip(),
            "emails": part_emails,
            "lastNameRange": extract_alpha_range(part),
            "splitFromMultiEmailLine": True,
        })
    return out or [row]


def to_collection_preview(rows: list[dict]) -> list[dict]:
    """Build academicAdvisors-shaped preview — only high-confidence, no invented fields."""
    preview = []
    for row in rows:
        if row["category"] != "probable_advisor_contact_line":
            continue
        email = row["emails"][0]
        name = row["text"].split(email)[0].strip(" :-–—")
        preview.append({
            "proposedId": email.split("@")[0],
            "name": name,
            "email": email,
            "lastNameRanges": [row["lastNameRange"]] if row.get("lastNameRange") else [],
            "semesters": None,
            "tracks": None,
            "sourceFile": row["file"],
            "sourceLine": row["text"],
            "confidence": "medium",
            "warnings": [
                "semesters not specified in source — must not invent",
                "tracks not specified in source — must not invent",
                "Only found in semester-1 registration guidelines",
            ],
        })
    return preview


def main():
    all_rows: list[dict] = []
    for path in sorted(SCRIPT_DIR.rglob("*.docx")):
        if "registration_guidelines" not in path.as_posix() and "yearbooks" not in path.as_posix():
            continue
        all_rows.extend(scan_docx_paragraphs(path))

    classified = []
    for row in all_rows:
        for split in split_multi_advisor_line(row):
            classified.append(classify_row(split))

    probable = [r for r in classified if r["category"] == "probable_advisor_contact_line"]
    structured = to_collection_preview(probable)
    missing_refs = [r for r in classified if r["category"] == "reference_missing_file"]

    recommend = "leave_empty"
    if structured:
        recommend = "partial_manual_only_do_not_auto_import"
    if missing_refs and not structured:
        recommend = "leave_empty_missing_source_file"

    report = {
        "generatedAt": datetime.now().isoformat(),
        "mode": "READ_ONLY",
        "collection": "academicAdvisors",
        "summary": {
            "filesScanned": len({r["file"] for r in all_rows}),
            "totalParagraphHits": len(all_rows),
            "classifiedRows": len(classified),
            "probableAdvisorLines": len(probable),
            "structuredPreviewRecords": len(structured),
            "referencesToMissingGeneralGuidelines": len(missing_refs),
            "allHaveEmail": all(s.get("email") for s in structured),
            "recommendation": recommend,
            "recommendImportToFirebase": False,
        },
        "structuredPreview": structured,
        "probableAdvisorLines": probable,
        "missingGeneralGuidelinesReferences": missing_refs,
        "otherClassifications": {
            k: len([r for r in classified if r["category"] == k])
            for k in sorted({r["category"] for r in classified})
        },
        "allHits": classified,
        "warnings": [
            "No 'הנחיות כלליות לרישום' file in import_sources/braude/ — semesters 2-7 defer advisor list to it",
            "Semester 1 has 3 probable advisor lines but missing semesters[] and tracks[] required by API",
            "Semester 8 contacts are track coordinators (מולקולרית/מזון) — not academic advisors",
            "Yearbooks mention 'יועצת' generically — no structured advisor data",
            "Labs XLSX staff column = lab lecturers — not academic advisors",
        ],
        "knowledgeCheckSuggestion": (
            "advisors=0 is already status 'empty' (ריק), not 'warning'. "
            "Consider documenting that advisors are optional until general guidelines file is imported or entered manually."
        ),
    }

    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"\nWrote {OUTPUT}")


if __name__ == "__main__":
    main()
