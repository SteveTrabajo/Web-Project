"""
Parse registration guidelines DOCX files into Firestore-ready documents.

Schema aligns with AdminRegistrationGuidelines.jsx emptyDoc().
"""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}")
URL_RE = re.compile(r"https?://\S+|www\.\S+")
DATE_RE = re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b")
TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")
SEMESTER_FILE_RE = re.compile(
    r"(?:סמסטר|סמ(?:סטר)?)\s*['\u05f3]?\s*(\d+)",
    re.IGNORECASE,
)

RULE_KEYWORDS = ("חובה", "אסור", "יש ל", "נא ל", "שימו לב", "חשוב", "דגשים", "הערה")


def normalize(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s).replace("\u00A0", " ")).strip()


def docx_paragraphs_text(file_path: Path) -> list[str]:
    doc = Document(str(file_path))
    return [normalize(p.text) for p in doc.paragraphs if normalize(p.text)]


def detect_semester_from_filename(filename: str) -> int | None:
    m = SEMESTER_FILE_RE.search(filename)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 8 else None
    m2 = re.search(r"\b([1-8])\b", filename)
    if m2 and ("הנחיות" in filename or "רישום" in filename):
        return int(m2.group(1))
    return None


def discover_registration_files(directory: Path) -> list[tuple[Path, int]]:
    if not directory.is_dir():
        return []
    found: list[tuple[Path, int]] = []
    for path in sorted(directory.glob("*")):
        if path.suffix.lower() != ".docx":
            continue
        sem = detect_semester_from_filename(path.name)
        if sem is None:
            continue
        found.append((path, sem))
    return found


def _parse_registration_window(paragraphs: list[str]) -> dict:
    window = {"date": "", "from": "", "to": "", "rawText": []}
    for p in paragraphs:
        if not any(kw in p for kw in ("רישום", "פתיחת הרישום", "חלון רישום", "שעות הרישום", "יתקיים בתאריך")):
            continue
        window["rawText"].append(p)
        dates = DATE_RE.findall(p)
        times = TIME_RE.findall(p)
        if dates and not window["date"]:
            d, mo, y = dates[0]
            y = y if len(y) == 4 else f"20{y}"
            window["date"] = f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
        if len(times) >= 1 and not window["from"]:
            window["from"] = f"{times[0][0].zfill(2)}:{times[0][1]}"
        if len(times) >= 2 and not window["to"]:
            window["to"] = f"{times[1][0].zfill(2)}:{times[1][1]}"
    return window


def _parse_contacts(paragraphs: list[str]) -> tuple[dict, list[dict], list[str]]:
    warnings: list[str] = []
    contacts = {
        "registrationSupport": [],
        "mentors": [],
        "academicAdvisors": [],
        "exemptions": [],
        "labs": [],
    }
    advisors: list[dict] = []

    for p in paragraphs:
        emails = EMAIL_RE.findall(p)
        phones = PHONE_RE.findall(p)
        if not emails and not phones:
            continue

        person = {
            "name": "",
            "role": "",
            "email": emails[0] if emails else "",
            "phone": phones[0] if phones else "",
        }
        if emails:
            before = p.split(emails[0])[0].strip(" :-–—")
            if 3 < len(before) < 80:
                person["name"] = before

        is_advisor = ("יועץ" in p or "יועצת" in p) and emails
        is_mentor = ("מנטור" in p or "מלווה" in p) and not is_advisor
        is_exemption = "פטור" in p or "חריג" in p
        is_lab = ("מעבדה" in p or "מעבדות" in p) and not is_advisor

        if is_advisor:
            advisor = {
                "name": person["name"],
                "email": person["email"],
                "assignment": {"lastNameFrom": "", "lastNameTo": "", "track": ""},
            }
            alpha = re.search(r"\(([א-ת])\s*[-–עד]+\s*([א-ת])'\)", p)
            if not alpha:
                alpha = re.search(r"([א-ת])\s*[-–]\s*([א-ת])", p)
            if alpha:
                advisor["assignment"]["lastNameFrom"] = alpha.group(1)
                advisor["assignment"]["lastNameTo"] = alpha.group(2)
            track_m = re.search(r"מסלול[:\s]+([^,\n]+)", p)
            if track_m:
                advisor["assignment"]["track"] = normalize(track_m.group(1))
            if not advisor["name"]:
                warnings.append(f"Advisor line without clear name: {p[:80]}...")
            contacts["academicAdvisors"].append(advisor)
            advisors.append(advisor)
        elif is_mentor:
            contacts["mentors"].append({
                "name": person["name"],
                "role": person.get("role") or "",
                "email": person["email"],
            })
        elif is_exemption:
            contacts["exemptions"].append(person)
        elif is_lab:
            contacts["labs"].append({
                "name": person["name"],
                "role": person.get("role") or "",
                "email": person["email"],
                "howToContact": p,
            })
        else:
            contacts["registrationSupport"].append(person)

    return contacts, advisors, warnings


def parse_registration_guidelines_docx(file_path: Path, semester: int | None = None) -> dict:
    """Parse DOCX into preview + Firestore document."""
    if semester is None:
        semester = detect_semester_from_filename(file_path.name)

    warnings: list[str] = []
    errors: list[str] = []
    parse_status = "ok"

    result = {
        "sourceFile": file_path.name,
        "semesterNumber": semester,
        "semesterId": f"semester_{semester}" if semester else None,
        "parseStatus": parse_status,
        "parseErrors": errors,
        "warnings": warnings,
        # preview-friendly aliases
        "title": "",
        "targetAudience": "",
        "term": "",
        "registrationWindow": {"date": "", "from": "", "to": ""},
        "creditRules": "",
        "importantRules": [],
        "contacts": {
            "registrationSupport": [],
            "mentors": [],
            "academicAdvisors": [],
            "exemptions": [],
            "labs": [],
        },
        "usefulLinks": [],
        "advisors": [],
    }

    if file_path.suffix.lower() != ".docx":
        result["parseStatus"] = "skipped"
        result["parseErrors"].append(f"Unsupported extension: {file_path.suffix}")
        return result

    try:
        paragraphs = docx_paragraphs_text(file_path)
    except Exception as exc:
        result["parseStatus"] = "error"
        result["parseErrors"].append(str(exc))
        return result

    if not paragraphs:
        result["parseStatus"] = "warning"
        warnings.append("No text paragraphs found in document")

    full_text = "\n".join(paragraphs)

    for p in paragraphs[:8]:
        if "הנחיות" in p and len(p) > 10:
            result["title"] = p
            break
    if not result["title"] and paragraphs:
        result["title"] = paragraphs[0]

    term_m = re.search(r"סמסטר\s*([ABאב])|מחצית\s*([ABאב])", full_text)
    if term_m:
        result["term"] = (term_m.group(1) or term_m.group(2) or "")[-1]

    for p in paragraphs:
        if any(kw in p for kw in ("שנתון", "קהל יעד", "לסטודנטים שייכים", "סטודנטים משנתון")):
            if len(p) > 15 and not result["targetAudience"]:
                result["targetAudience"] = p

    for p in paragraphs:
        if any(kw in p for kw in ('נ"ז', "נקודות זכות", "נק״ז", "נקודות הזכות")):
            if len(p) > 10:
                result["creditRules"] = p
                break

    reg_window = _parse_registration_window(paragraphs)
    result["registrationWindow"] = {
        "date": reg_window["date"],
        "from": reg_window["from"],
        "to": reg_window["to"],
    }
    if reg_window["rawText"] and not reg_window["date"]:
        warnings.append("Registration window text found but date not parsed clearly")

    reg_raw_set = set(reg_window["rawText"])
    for p in paragraphs:
        if len(p) < 20:
            continue
        if any(kw in p for kw in RULE_KEYWORDS):
            if p not in reg_raw_set:
                result["importantRules"].append({
                    "code": f"RULE_{len(result['importantRules']) + 1}",
                    "text": p,
                })

    seen_urls: set[str] = set()
    for url in URL_RE.findall(full_text):
        clean = url.rstrip(".,;)")
        if clean not in seen_urls:
            seen_urls.add(clean)
            result["usefulLinks"].append({"label": clean, "url": clean})

    contacts, advisors, contact_warnings = _parse_contacts(paragraphs)
    result["contacts"] = contacts
    result["advisors"] = advisors
    warnings.extend(contact_warnings)

    if semester is None:
        warnings.append("Semester not detected from filename")
        result["parseStatus"] = "warning"

    if not result["importantRules"] and not result["title"]:
        warnings.append("Limited content extracted — manual review recommended")

    if result["parseStatus"] == "ok" and warnings:
        result["parseStatus"] = "warning"

    return result


def to_firestore_document(parsed: dict) -> dict:
    """Map parsed preview to registrationGuidelines Firestore document."""
    sem = parsed.get("semesterNumber")
    return {
        "semesterNumber": sem,
        "term": parsed.get("term") or "",
        "title": parsed.get("title") or "",
        "registrationWindow": {
            "date": parsed.get("registrationWindow", {}).get("date") or "",
            "from": parsed.get("registrationWindow", {}).get("from") or "",
            "to": parsed.get("registrationWindow", {}).get("to") or "",
        },
        "audience": {
            "cohortText": parsed.get("targetAudience") or "",
            "creditsRuleText": parsed.get("creditRules") or None,
            "creditsRange": None,
        },
        "contacts": parsed.get("contacts") or {
            "registrationSupport": [],
            "mentors": [],
            "academicAdvisors": [],
            "exemptions": [],
            "labs": [],
        },
        "keyRules": parsed.get("importantRules") or [],
        "links": parsed.get("usefulLinks") or [],
    }


def scan_all_registration_guidelines(reg_dir: Path) -> dict:
    """Build registration-guidelines-only preview for semesters 1–8."""
    from datetime import datetime

    files = discover_registration_files(reg_dir)
    by_semester = {sem: path for path, sem in files}

    semesters: list[dict] = []
    warnings: list[dict] = []
    missing_files = [n for n in range(1, 9) if n not in by_semester]

    for sem in range(1, 9):
        if sem not in by_semester:
            semesters.append({
                "semesterNumber": sem,
                "semesterId": f"semester_{sem}",
                "parseStatus": "missing",
                "sourceFile": None,
                "warnings": ["No DOCX file found for this semester"],
            })
            continue

        path = by_semester[sem]
        parsed = parse_registration_guidelines_docx(path, sem)
        parsed["sourceFile"] = path.relative_to(reg_dir.parent).as_posix() if reg_dir.parent else path.name
        semesters.append(parsed)

        if parsed.get("parseStatus") in ("warning", "error", "skipped", "missing"):
            warnings.append({
                "semester": sem,
                "file": parsed.get("sourceFile"),
                "status": parsed.get("parseStatus"),
                "messages": parsed.get("parseErrors", []) + parsed.get("warnings", []),
            })

    ready = [s for s in semesters if s.get("parseStatus") in ("ok", "warning") and s.get("sourceFile")]

    return {
        "generatedAt": datetime.now().isoformat(),
        "mode": "DRY_RUN",
        "collection": "registrationGuidelines",
        "semesters": semesters,
        "warnings": warnings,
        "missingSemesters": missing_files,
        "summary": {
            "filesFound": len(files),
            "semestersReady": len(ready),
            "semestersMissing": len(missing_files),
            "totalImportantRules": sum(len(s.get("importantRules") or []) for s in ready),
            "totalContacts": sum(
                sum(len((s.get("contacts") or {}).get(k) or []) for k in (
                    "registrationSupport", "mentors", "academicAdvisors", "exemptions", "labs"
                ))
                for s in ready
            ),
            "totalAdvisors": sum(len(s.get("advisors") or []) for s in ready),
            "totalLinks": sum(len(s.get("usefulLinks") or []) for s in ready),
            "readyForFirebaseWrite": len(missing_files) == 0 and all(
                s.get("parseStatus") != "error" for s in ready
            ),
        },
    }
