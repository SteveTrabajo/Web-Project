#!/usr/bin/env python3
"""
Safely delete the test yearbook shell from Firebase.

Deletes ONLY: yearbooks/test and all nested subcollections.

Default: dry-run (preview only).
Use --write to delete after approval.

Usage:
  py server/import_sources/braude/delete_test_yearbook.py --dry-run
  py server/import_sources/braude/delete_test_yearbook.py --write
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

SCRIPT_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPT_DIR.parent.parent
ENV_FILE = SERVER_DIR / ".env"

TARGET_DOC_ID = "test"
TARGET_COLLECTION = "yearbooks"


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


def collect_subcollection_tree(doc_ref, depth=0) -> list[dict]:
    """Recursively list all subcollections and document counts under doc_ref."""
    items = []
    for subcoll in doc_ref.collections():
        coll_path = subcoll.id
        for subdoc in subcoll.stream():
            sub_path = f"{coll_path}/{subdoc.id}"
            items.append({
                "path": sub_path,
                "depth": depth,
                "hasData": bool(subdoc.to_dict()),
            })
            nested = collect_subcollection_tree(subdoc.reference, depth + 1)
            for n in nested:
                items.append({
                    "path": f"{sub_path}/{n['path']}",
                    "depth": n["depth"],
                    "hasData": n["hasData"],
                })
            # count courses and relations under semesters
            for deeper in subdoc.reference.collections():
                count = sum(1 for _ in deeper.stream())
                if count:
                    items.append({
                        "path": f"{sub_path}/{deeper.id} ({count} docs)",
                        "depth": depth + 1,
                        "hasData": True,
                    })
    return items


def scan_test_yearbook(db) -> dict:
    ref = db.collection(TARGET_COLLECTION).document(TARGET_DOC_ID)
    doc = ref.get()

    result = {
        "target": f"{TARGET_COLLECTION}/{TARGET_DOC_ID}",
        "exists": doc.exists,
        "documentData": doc.to_dict() if doc.exists else None,
        "subcollections": [],
        "coursesCount": 0,
        "relationsCount": 0,
        "semesterCount": 0,
    }

    if not doc.exists:
        return result

    for sem_coll in ref.collection("requiredCourses").stream():
        result["semesterCount"] += 1
        result["subcollections"].append(f"requiredCourses/{sem_coll.id}")
        for course in sem_coll.reference.collection("courses").stream():
            result["coursesCount"] += 1
            result["subcollections"].append(
                f"requiredCourses/{sem_coll.id}/courses/{course.id}"
            )
            rel_count = sum(1 for _ in course.reference.collection("relations").stream())
            result["relationsCount"] += rel_count
            if rel_count:
                result["subcollections"].append(
                    f"requiredCourses/{sem_coll.id}/courses/{course.id}/relations ({rel_count})"
                )

    # Any other top-level subcollections under test
    for coll in ref.collections():
        if coll.id == "requiredCourses":
            continue
        for subdoc in coll.stream():
            result["subcollections"].append(f"{coll.id}/{subdoc.id}")

    return result


def delete_collection_recursive(coll_ref, batch_size=100) -> int:
    deleted = 0
    docs = list(coll_ref.limit(batch_size).stream())
    while docs:
        batch = coll_ref._client.batch()
        for doc in docs:
            for sub in doc.reference.collections():
                deleted += delete_collection_recursive(sub, batch_size)
            batch.delete(doc.reference)
            deleted += 1
        batch.commit()
        docs = list(coll_ref.limit(batch_size).stream())
    return deleted


def delete_test_yearbook(db) -> dict:
    ref = db.collection(TARGET_COLLECTION).document(TARGET_DOC_ID)
    if not ref.get().exists:
        return {"deleted": False, "reason": "document_not_found", "docsDeleted": 0}

    docs_deleted = 0
    for subcoll in list(ref.collections()):
        docs_deleted += delete_collection_recursive(subcoll)

    ref.delete()
    docs_deleted += 1

    return {"deleted": True, "docsDeleted": docs_deleted}


def print_scan(scan: dict, mode: str) -> None:
    sep = "=" * 60
    print(sep)
    print(f"Delete test yearbook — {mode.upper()}")
    print(sep)
    print(f"\nTarget (ONLY): {scan['target']}")
    print(f"Exists: {scan['exists']}")

    if scan["exists"]:
        print(f"Document data: {scan['documentData']}")
        print(f"Semesters (requiredCourses): {scan['semesterCount']}")
        print(f"Courses: {scan['coursesCount']}")
        print(f"Relations: {scan['relationsCount']}")
        if scan["subcollections"]:
            print("\nSubcollection paths:")
            for p in scan["subcollections"]:
                print(f"  - {p}")
        else:
            print("\nNo subcollections found (empty shell).")
    else:
        print("\nNothing to delete — document does not exist.")

    if mode == "dry-run":
        print("\n--- ACTION ---")
        print("  No deletion performed.")
        if scan["exists"]:
            print("  To delete, run:")
            print("    py server/import_sources/braude/delete_test_yearbook.py --write")
    print(sep)


def parse_args():
    parser = argparse.ArgumentParser(description="Delete yearbooks/test only.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    group.add_argument("--write", action="store_true", help="Delete yearbooks/test")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    do_write = args.write

    db = init_firebase()
    scan = scan_test_yearbook(db)

    if not do_write:
        print_scan(scan, "dry-run")
        return 0

    if not scan["exists"]:
        print_scan(scan, "write-skipped")
        print("\nDocument already absent.")
        return 0

    print_scan(scan, "write (pre-delete)")
    print("\nDeleting...")
    result = delete_test_yearbook(db)
    print(f"\nDone. docsDeleted={result['docsDeleted']}")

    verify = scan_test_yearbook(db)
    print(f"Verify exists after delete: {verify['exists']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
