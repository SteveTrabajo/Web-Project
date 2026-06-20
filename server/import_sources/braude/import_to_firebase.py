#!/usr/bin/env python3
"""
Import Braude yearbooks and lab schedules to Firebase.

Default mode: DRY RUN (no Firebase writes).
Use --write only when explicitly approved.

Usage:
  py server/import_sources/braude/import_to_firebase.py --labs-only --dry-run
  py server/import_sources/braude/import_to_firebase.py --labs-only --write
  py server/import_sources/braude/import_to_firebase.py --yearbooks-only --dry-run
  py server/import_sources/braude/import_to_firebase.py --dry-run
  py server/import_sources/braude/import_to_firebase.py --write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPT_DIR.parent.parent
PARSERS_DIR = SERVER_DIR / "parsers"
ENV_FILE = SERVER_DIR / ".env"

PYTHON_CMD = "py" if sys.platform == "win32" else "python3"

# ---------------------------------------------------------------------------
# Manual mappings (approved)
# ---------------------------------------------------------------------------

YEARBOOK_FILES: dict[str, dict[str, str]] = {
    "שנתון  תשפג מעודכן.docx": {
        "yearbookId": "tashpag",
        "label": 'תשפ"ג',
        "relativePath": "yearbooks/שנתון  תשפג מעודכן.docx",
    },
    "שנתון תשפד- עדכון התמחויות.docx": {
        "yearbookId": "tashpad",
        "label": 'תשפ"ד',
        "relativePath": "yearbooks/שנתון תשפד- עדכון התמחויות.docx",
    },
    "שנתון תשפה- מעודכן.docx": {
        "yearbookId": "tashpah",
        "label": 'תשפ"ה',
        "relativePath": "yearbooks/שנתון תשפה- מעודכן.docx",
    },
    "שנתון תשפו.docx": {
        "yearbookId": "tashpav",
        "label": 'תשפ"ו',
        "relativePath": "yearbooks/שנתון תשפו.docx",
    },
}

LAB_YEAR = {
    "yearId": "tashpav",
    "yearLabel": 'תשפ"ו',
}

# Semesters 2–7; files matched by "סמסטר N" in filename under labs/
LAB_SEMESTER_RE = re.compile(r"סמסטר\s*(\d+)")


@dataclass
class YearbookPlan:
    file_name: str
    relative_path: str
    file_path: Path
    yearbook_id: str
    label: str
    course_count: int = 0
    relation_count: int = 0
    semesters: list[int] | None = None
    parse_status: str = "pending"
    parse_errors: list[str] | None = None


@dataclass
class LabPlan:
    file_name: str
    relative_path: str
    file_path: Path
    semester: int
    year_id: str
    year_label: str
    course_count: int = 0
    lab_record_count: int = 0
    missing_date: int = 0
    missing_staff: int = 0
    rows_with_issues: int = 0
    parse_status: str = "pending"
    parse_errors: list[str] | None = None


def load_dotenv_readonly(env_path: Path) -> None:
    """Load server/.env into os.environ without modifying the file."""
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def import_preview_module():
    """Import dry-run parsers from generate_import_preview (no Firebase)."""
    sys.path.insert(0, str(SCRIPT_DIR))
    import generate_import_preview as preview  # noqa: WPS433

    return preview


def discover_lab_files() -> list[tuple[Path, int]]:
    labs_dir = SCRIPT_DIR / "labs"
    if not labs_dir.is_dir():
        return []

    found: list[tuple[Path, int]] = []
    for path in sorted(labs_dir.glob("*.xlsx")):
        m = LAB_SEMESTER_RE.search(path.name)
        if not m:
            continue
        semester = int(m.group(1))
        found.append((path, semester))
    return found


def validate_yearbook_plans(plans: list[YearbookPlan], warnings: list[str]) -> bool:
    ok = True
    for plan in plans:
        if not plan.file_path.is_file():
            ok = False
            warnings.append(f"Yearbook file missing: {plan.relative_path}")
        if not plan.yearbook_id or not plan.yearbook_id.strip():
            ok = False
            warnings.append(f"Empty yearbookId for {plan.file_name}")
        if plan.parse_status == "error":
            ok = False
            warnings.append(f"Yearbook parse error ({plan.file_name}): {plan.parse_errors}")
    return ok


def validate_lab_plans(plans: list[LabPlan], warnings: list[str]) -> bool:
    ok = True
    for plan in plans:
        if not plan.file_path.is_file():
            ok = False
            warnings.append(f"Lab file missing: {plan.relative_path}")
        if not (1 <= plan.semester <= 8):
            ok = False
            warnings.append(f"Invalid semester {plan.semester} in {plan.file_name} (must be 1–8)")
        if not plan.year_id or plan.year_id.strip() in ("", "labs_unknown_year"):
            ok = False
            warnings.append(f"Invalid yearId '{plan.year_id}' for {plan.file_name}")
        if plan.parse_status == "error":
            ok = False
            warnings.append(f"Lab parse error ({plan.file_name}): {plan.parse_errors}")
    return ok


def import_labs_parser():
    sys.path.insert(0, str(PARSERS_DIR))
    import labs_parser  # noqa: WPS433

    return labs_parser


def build_lab_plans(labs_mod) -> tuple[list[LabPlan], list[str]]:
    warnings: list[str] = []
    lab_plans: list[LabPlan] = []

    for path, semester in discover_lab_files():
        rel = path.relative_to(SCRIPT_DIR).as_posix()
        plan = LabPlan(
            file_name=path.name,
            relative_path=rel,
            file_path=path,
            semester=semester,
            year_id=LAB_YEAR["yearId"],
            year_label=LAB_YEAR["yearLabel"],
        )

        if semester < 2 or semester > 7:
            warnings.append(
                f"Lab file {path.name}: semester {semester} outside expected range 2–7 (will still validate 1–8)"
            )

        try:
            courses_map = labs_mod.parse_workbook_data(path)
            quality = labs_mod.count_lab_quality_issues(courses_map)
            plan.course_count = len(courses_map)
            plan.lab_record_count = quality["totalRecords"]
            plan.missing_date = quality["missingDate"]
            plan.missing_staff = quality["missingStaff"]
            plan.rows_with_issues = quality["rowsWithMissingFields"]
            plan.parse_status = "ok" if plan.lab_record_count > 0 else "warning"
            if plan.lab_record_count == 0:
                plan.parse_errors = ["No lab records extracted"]
        except Exception as exc:
            plan.parse_status = "error"
            plan.parse_errors = [str(exc)]

        lab_plans.append(plan)

    if not lab_plans:
        warnings.append("No lab XLSX files found under labs/")

    expected_semesters = {2, 3, 4, 5, 6, 7}
    found_semesters = {p.semester for p in lab_plans}
    missing = expected_semesters - found_semesters
    if missing:
        warnings.append(f"Missing lab files for semester(s): {sorted(missing)}")

    return lab_plans, warnings


def build_yearbook_plans(preview_mod) -> list[YearbookPlan]:
    yearbook_plans: list[YearbookPlan] = []
    for file_name, cfg in YEARBOOK_FILES.items():
        rel = cfg["relativePath"]
        path = SCRIPT_DIR / rel.replace("/", os.sep)
        plan = YearbookPlan(
            file_name=file_name,
            relative_path=rel,
            file_path=path,
            yearbook_id=cfg["yearbookId"],
            label=cfg["label"],
        )

        if path.is_file():
            meta = {
                "relativePath": rel,
                "type": "yearbook",
                "extension": path.suffix.lower(),
                "yearbookHint": {
                    "suggestedYearbookId": cfg["yearbookId"],
                    "suggestedLabel": cfg["label"],
                },
            }
            try:
                result = preview_mod.preview_yearbook(path, meta)
                plan.course_count = result.get("courseCount", 0)
                plan.relation_count = result.get("relationCount", 0)
                plan.semesters = [s["semesterNumber"] for s in result.get("semesters", [])]
                plan.parse_status = result.get("parseStatus", "ok")
                plan.parse_errors = result.get("parseErrors", [])
            except Exception as exc:
                plan.parse_status = "error"
                plan.parse_errors = [str(exc)]
        else:
            plan.parse_status = "error"
            plan.parse_errors = ["File not found"]

        yearbook_plans.append(plan)

    return yearbook_plans


def build_plans(preview_mod, labs_mod) -> tuple[list[YearbookPlan], list[LabPlan], list[str]]:
    yearbook_plans = build_yearbook_plans(preview_mod)
    lab_plans, lab_warnings = build_lab_plans(labs_mod)
    return yearbook_plans, lab_plans, lab_warnings


def print_summary(
    mode: str,
    yearbook_plans: list[YearbookPlan],
    lab_plans: list[LabPlan],
    warnings: list[str],
    write_results: list[dict] | None = None,
    scope: str = "all",
) -> None:
    sep = "=" * 60
    print(sep)
    scope_label = {"all": "ALL", "labs": "LABS ONLY", "yearbooks": "YEARBOOKS ONLY"}[scope]
    print(f"Braude Firebase Import — {mode.upper()} ({scope_label})")
    print(sep)

    if scope != "labs":
        print("\n--- YEARBOOKS (collection: yearbooks) ---")
        total_courses = 0
        total_relations = 0
        for p in yearbook_plans:
            exists = "OK" if p.file_path.is_file() else "MISSING"
            print(f"  [{exists}] {p.relative_path}")
            print(f"       yearbookId: {p.yearbook_id}  |  label: {p.label}")
            print(f"       courses: {p.course_count}  |  relations: {p.relation_count}  |  status: {p.parse_status}")
            if p.semesters:
                print(f"       semesters in doc: {sorted(p.semesters)}")
            total_courses += p.course_count
            total_relations += p.relation_count
        print(f"\n  Total yearbooks: {len(yearbook_plans)}")
        print(f"  Total courses (sum across files): {total_courses}")
        print(f"  Total relations (sum across files): {total_relations}")
    else:
        print("\n--- YEARBOOKS ---")
        print("  (skipped — labs-only mode)")

    if scope != "yearbooks":
        print("\n--- LAB SCHEDULES (collection: lab_schedule) ---")
        print(f"  yearId: {LAB_YEAR['yearId']}  |  yearLabel: {LAB_YEAR['yearLabel']}")
        total_lab_records = 0
        total_missing_date = 0
        total_missing_staff = 0
        total_rows_with_issues = 0
        for p in sorted(lab_plans, key=lambda x: x.semester):
            exists = "OK" if p.file_path.is_file() else "MISSING"
            print(f"  [{exists}] semester {p.semester}: {p.relative_path}")
            print(
                f"       courses: {p.course_count}  |  lab records: {p.lab_record_count}"
                f"  |  missing date: {p.missing_date}  |  missing staff: {p.missing_staff}"
                f"  |  status: {p.parse_status}"
            )
            total_lab_records += p.lab_record_count
            total_missing_date += p.missing_date
            total_missing_staff += p.missing_staff
            total_rows_with_issues += p.rows_with_issues
        print(f"\n  Total lab semesters: {len(lab_plans)}")
        print(f"  Total lab records: {total_lab_records}")
        print(f"  Rows with any missing field (KC rules): {total_rows_with_issues}")
        print(f"  Missing date (rows): {total_missing_date}")
        print(f"  Missing staff (rows): {total_missing_staff}")
        if scope == "labs" and mode == "dry-run":
            print(f"\n  Write targets: lab_schedule/{LAB_YEAR['yearId']}/semesters/2..7")
    else:
        print("\n--- LAB SCHEDULES ---")
        print("  (skipped — yearbooks-only mode)")

    if write_results:
        print("\n--- WRITE RESULTS ---")
        for r in write_results:
            status = "OK" if r["ok"] else "FAILED"
            print(f"  [{status}] {r['kind']}: {r['target']}")
            if r.get("detail"):
                print(f"         {r['detail']}")

    if warnings:
        print("\n--- WARNINGS ---")
        for w in warnings:
            print(f"  ! {w}")

    if mode == "dry-run":
        print("\n--- NEXT STEP ---")
        print("  No data was written to Firebase.")
        if scope == "labs":
            print("  To re-import labs only, run:")
            print("    py server/import_sources/braude/import_to_firebase.py --labs-only --write")
        elif scope == "yearbooks":
            print("  To import yearbooks only, run:")
            print("    py server/import_sources/braude/import_to_firebase.py --yearbooks-only --write")
        else:
            print("  To import, run:")
            print("    py server/import_sources/braude/import_to_firebase.py --write")
    else:
        print("\n--- POST-IMPORT VERIFICATION ---")
        print("  Start the server, then run:")
        print("    curl http://localhost:3000/api/admin/knowledge-check")
        print("  Expect: yearbooks > 0, courses > 0, relations > 0,")
        print("          labYears > 0, labSemesters > 0")

    print(sep)


def run_parser(cmd: list[str], cwd: Path) -> tuple[bool, str]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=os.environ.copy(),
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode == 0, out.strip()
    except Exception as exc:
        return False, str(exc)


def execute_write(
    yearbook_plans: list[YearbookPlan],
    lab_plans: list[LabPlan],
    scope: str = "all",
) -> list[dict]:
    load_dotenv_readonly(ENV_FILE)
    required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]
    missing_env = [k for k in required if not os.environ.get(k)]
    if missing_env:
        raise RuntimeError(
            f"Missing Firebase env vars: {', '.join(missing_env)}. "
            f"Ensure {ENV_FILE} exists and is loaded."
        )

    results: list[dict] = []

    if scope in ("all", "yearbooks"):
        for plan in yearbook_plans:
            cmd = [
                PYTHON_CMD,
                str(PARSERS_DIR / "yearbook_parser.py"),
                str(plan.file_path),
                plan.yearbook_id,
                plan.label,
            ]
            ok, detail = run_parser(cmd, SERVER_DIR)
            results.append({
                "ok": ok,
                "kind": "yearbook",
                "target": f"{plan.yearbook_id} ({plan.relative_path})",
                "detail": detail if not ok else "yearbook_parser.py finished",
            })

    if scope in ("all", "labs"):
        for plan in sorted(lab_plans, key=lambda p: p.semester):
            cmd = [
                PYTHON_CMD,
                str(PARSERS_DIR / "labs_parser.py"),
                str(plan.file_path),
                plan.year_id,
                plan.year_label,
                str(plan.semester),
            ]
            ok, detail = run_parser(cmd, SERVER_DIR)
            results.append({
                "ok": ok,
                "kind": "lab_schedule",
                "target": f"{plan.year_id}/semesters/{plan.semester} ({plan.relative_path})",
                "detail": detail if not ok else "labs_parser.py finished",
            })

    return results


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import Braude yearbooks and labs to Firebase (dry-run by default)."
    )
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument(
        "--labs-only",
        action="store_true",
        help="Import/re-preview labs only — does not touch yearbooks",
    )
    scope.add_argument(
        "--yearbooks-only",
        action="store_true",
        help="Import/re-preview yearbooks only — does not touch labs",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview only — no Firebase writes (default)",
    )
    mode.add_argument(
        "--write",
        action="store_true",
        help="Write to Firebase using yearbook_parser.py and/or labs_parser.py",
    )
    return parser.parse_args()


def resolve_scope(args: argparse.Namespace) -> str:
    if args.labs_only:
        return "labs"
    if args.yearbooks_only:
        return "yearbooks"
    return "all"


def main() -> int:
    args = parse_args()
    do_write = args.write
    scope = resolve_scope(args)

    preview_mod = import_preview_module()
    labs_mod = import_labs_parser()
    yearbook_plans, lab_plans, warnings = build_plans(preview_mod, labs_mod)

    yb_ok = True if scope == "labs" else validate_yearbook_plans(yearbook_plans, warnings)
    lab_ok = True if scope == "yearbooks" else validate_lab_plans(lab_plans, warnings)
    all_ok = yb_ok and lab_ok

    if not do_write:
        print_summary("dry-run", yearbook_plans, lab_plans, warnings, scope=scope)
        if not all_ok:
            print("\nValidation failed — fix issues before running --write.")
            return 1
        return 0

    if not all_ok:
        print_summary("write-aborted", yearbook_plans, lab_plans, warnings, scope=scope)
        print("\nWrite aborted due to validation errors.")
        return 1

    print_summary("write (pre-flight)", yearbook_plans, lab_plans, warnings, scope=scope)

    print("\nWriting to Firebase...\n")
    write_results = execute_write(yearbook_plans, lab_plans, scope=scope)
    failed = [r for r in write_results if not r["ok"]]

    print_summary("write", yearbook_plans, lab_plans, warnings, write_results=write_results, scope=scope)

    if failed:
        print(f"\n{len(failed)} write operation(s) failed.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
