#!/usr/bin/env python3
"""
Import registration guidelines from local DOCX files to Firebase.

Default: dry-run only.
Use --write only after explicit approval.

Does NOT touch yearbooks or lab_schedule.

Usage:
  py server/import_sources/braude/import_registration_guidelines.py --dry-run
  py server/import_sources/braude/import_registration_guidelines.py --write
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import firebase_admin
from firebase_admin import credentials, firestore

from registration_guidelines_parser import (
    discover_registration_files,
    parse_registration_guidelines_docx,
    scan_all_registration_guidelines,
    to_firestore_document,
)

SERVER_DIR = SCRIPT_DIR.parent.parent
ENV_FILE = SERVER_DIR / ".env"
REG_DIR = SCRIPT_DIR / "registration_guidelines"
COLLECTION = "registrationGuidelines"


def load_dotenv_readonly(env_path: Path) -> None:
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


def init_firebase():
    load_dotenv_readonly(ENV_FILE)
    required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing Firebase env vars: {', '.join(missing)}")

    if not firebase_admin._apps:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": os.environ["FIREBASE_PROJECT_ID"],
            "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
            "private_key": os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
    return firestore.client()


def count_contacts(contacts: dict) -> int:
    return sum(len(contacts.get(k) or []) for k in (
        "registrationSupport", "mentors", "academicAdvisors", "exemptions", "labs"
    ))


def field_presence(parsed: dict) -> dict:
    rw = parsed.get("registrationWindow") or {}
    return {
        "title": bool(parsed.get("title")),
        "targetAudience": bool(parsed.get("targetAudience")),
        "term": bool(parsed.get("term")),
        "registrationWindow": bool(rw.get("date") or rw.get("from") or rw.get("to")),
        "creditRules": bool(parsed.get("creditRules")),
        "importantRules": len(parsed.get("importantRules") or []),
        "contacts": count_contacts(parsed.get("contacts") or {}),
        "usefulLinks": len(parsed.get("usefulLinks") or []),
        "advisors": len(parsed.get("advisors") or []),
    }


def print_dry_run_summary(preview: dict) -> None:
    sep = "=" * 60
    print(sep)
    print("Registration Guidelines Import — DRY-RUN")
    print(sep)
    print(f"\nCollection: {COLLECTION}")
    print(f"Files found: {preview['summary']['filesFound']}")
    print(f"Semesters ready: {preview['summary']['semestersReady']} / 8")
    print(f"Missing semesters: {preview['summary'].get('missingSemesters') or 'none'}")

    for sem in preview.get("semesters", []):
        sid = sem.get("semesterId") or f"semester_{sem.get('semesterNumber')}"
        status = sem.get("parseStatus", "?")
        print(f"\n--- {sid} [{status}] ---")
        if sem.get("sourceFile"):
            print(f"  file: {sem['sourceFile']}")
        fields = field_presence(sem) if status not in ("missing", "skipped") else {}
        if fields:
            print(f"  fields: {json.dumps(fields, ensure_ascii=False)}")
        if sem.get("title"):
            print(f"  title: {sem['title'][:100]}{'...' if len(sem['title'])>100 else ''}")
        if sem.get("targetAudience"):
            print(f"  audience: {sem['targetAudience'][:80]}...")
        rw = sem.get("registrationWindow") or {}
        if any(rw.get(k) for k in ("date", "from", "to")):
            print(f"  registrationWindow: {rw}")
        if sem.get("warnings"):
            for w in sem["warnings"]:
                print(f"  ! {w}")

    print(f"\n--- TOTALS ---")
    s = preview["summary"]
    print(f"  importantRules: {s['totalImportantRules']}")
    print(f"  contacts: {s['totalContacts']}")
    print(f"  advisors (in guidelines): {s['totalAdvisors']}")
    print(f"  links: {s['totalLinks']}")

    if preview.get("warnings"):
        print(f"\n--- GLOBAL WARNINGS ({len(preview['warnings'])}) ---")
        for w in preview["warnings"]:
            print(f"  ! sem {w.get('semester')}: {w.get('messages')}")

    print(f"\n  readyForFirebaseWrite: {s['readyForFirebaseWrite']}")
    print("\n--- NEXT STEP ---")
    print("  No data written to Firebase.")
    print("  To import:")
    print("    py server/import_sources/braude/import_registration_guidelines.py --write")
    print(sep)


def execute_write(db, preview: dict) -> list[dict]:
    results = []
    for sem in preview.get("semesters", []):
        if sem.get("parseStatus") in ("missing", "error", "skipped"):
            results.append({
                "ok": False,
                "semesterId": sem.get("semesterId"),
                "detail": f"Skipped — status {sem.get('parseStatus')}",
            })
            continue

        doc_id = sem.get("semesterId") or f"semester_{sem['semesterNumber']}"
        body = to_firestore_document(sem)
        db.collection(COLLECTION).document(doc_id).set(body, merge=True)
        results.append({
            "ok": True,
            "semesterId": doc_id,
            "detail": f"Written {doc_id}",
        })
    return results


def parse_args():
    parser = argparse.ArgumentParser(
        description="Import registration guidelines to Firebase (dry-run by default)."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    group.add_argument("--write", action="store_true", help="Write to Firebase")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    do_write = args.write

    preview = scan_all_registration_guidelines(REG_DIR)

    if not do_write:
        print_dry_run_summary(preview)
        out_path = SCRIPT_DIR / "registration-guidelines-preview.json"
        out_path.write_text(json.dumps(preview, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nPreview saved: {out_path}")
        if not preview["summary"]["readyForFirebaseWrite"]:
            return 1
        return 0

    if not preview["summary"]["readyForFirebaseWrite"]:
        print_dry_run_summary(preview)
        print("\nWrite aborted — not all semesters are ready.")
        return 1

    print_dry_run_summary(preview)
    print("\nWriting to Firebase...\n")
    db = init_firebase()
    results = execute_write(db, preview)

    print("--- WRITE RESULTS ---")
    failed = 0
    for r in results:
        status = "OK" if r["ok"] else "FAILED"
        print(f"  [{status}] {r['semesterId']}: {r['detail']}")
        if not r["ok"]:
            failed += 1

    print("\n--- POST-IMPORT ---")
    print("  curl http://localhost:3000/api/admin/knowledge-check")
    print("  Expect: registrationGuidelinesCount > 0")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
