import sys
import re
from pathlib import Path
import os

from openpyxl import load_workbook

import firebase_admin
from firebase_admin import credentials, firestore
"""
labs_parser.py

Reads an Excel lab-schedule file and imports it into Firestore:
- Detects tables by matching expected column headers (REQUIRED_HEADERS)
- Associates labs with courses by looking for a course title line above each table
- Stores sessions: date, day, time, group, staff
- Supports multiple worksheets and variable column layouts

Usage: python labs_parser.py <file_path> <year_id> <year_label> <semester>
"""

# ==============================
# Firebase init
# ==============================
if not firebase_admin._apps:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.environ["FIREBASE_PROJECT_ID"],
        "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
        "private_key": os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ==============================
# Required headers (UNCHANGED)
# ==============================
REQUIRED_HEADERS = {
    "staff": ["שם המרצה", "מרצה"],
    "group": ["קבוצת מעבדה", "קבוצה"],
    "time": ["שעה"],
    "day": ["יום"],
    "date": ["תאריך"],
    "sessionNo": ["מס' מע'", "מספר מעבדה", "מס׳ מע", "מס' מעבדה"],
    "sessionName": ["שם המקצוע", "שם הקורס"],
}

# ==============================
# Helpers
# ==============================
def norm(x):
    if x is None:
        return ""
    return re.sub(r"\s+", " ", str(x)).strip()

def build_header(ws, row, max_col):
    cells = [norm(ws.cell(row=row, column=c).value) for c in range(1, max_col + 1)]
    mapping = {}
    hits = 0

    for key, variants in REQUIRED_HEADERS.items():
        for i, txt in enumerate(cells, start=1):
            if txt and any(v in txt for v in variants):
                mapping[key] = i
                hits += 1
                break

    return mapping, hits

def is_table_header_row(hits):
    return hits >= 5

def extract_course_from_line(text):
    t = norm(text)
    if not t:
        return None, None

    m = re.search(r"(.+?)\s*[-–]\s*(\d{4,6})$", t)
    if m:
        return m.group(2), norm(m.group(1))

    m = re.search(r"^(\d{4,6})\s*[-–]\s*(.+)$", t)
    if m:
        return m.group(1), norm(m.group(2))

    return None, None

def find_course_title_near(ws, header_row, max_col):
    for r in range(header_row - 1, max(1, header_row - 8), -1):
        line = " ".join(
            norm(ws.cell(row=r, column=c).value)
            for c in range(1, max_col + 1)
            if ws.cell(row=r, column=c).value
        )
        code, name = extract_course_from_line(line)
        if code and name:
            return code, name

    return None, None

# ==============================
# Core logic
# ==============================
def parse_workbook(path: Path, year_id: str, year_label: str, semester: str):
    wb = load_workbook(path, data_only=True)

    # Root year doc
    year_ref = db.collection("lab_schedule").document(year_id)
    year_ref.set(
        {
            "year": year_label,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )

    semester_ref = year_ref.collection("semesters").document(str(semester))
    courses_map = {}

    for ws in wb.worksheets:
        r = 1
        while r <= ws.max_row:
            header, hits = build_header(ws, r, ws.max_column)

            if not is_table_header_row(hits):
                r += 1
                continue

            course_code, course_name = find_course_title_near(ws, r, ws.max_column)
            if not course_code:
                r += 1
                continue

            courses_map.setdefault(
                course_code,
                {
                    "courseCode": str(course_code),
                    "courseName": course_name,
                    "labs": [],
                },
            )

            rr = r + 1
            while rr <= ws.max_row:
                date_val = norm(ws.cell(rr, header.get("date", 0)).value)
                day_val = norm(ws.cell(rr, header.get("day", 0)).value)

                # session: prefer sessionNo, fallback to sessionName
                session_val = ""
                if header.get("sessionNo"):
                    session_val = norm(ws.cell(rr, header["sessionNo"]).value)

                if not session_val and header.get("sessionName"):
                    session_val = norm(ws.cell(rr, header["sessionName"]).value)

                if not session_val and not date_val and not day_val:
                    break

                lab = {
                    "session": session_val,
                    "date": date_val,
                    "day": day_val,
                    "group": norm(ws.cell(rr, header.get("group", 0)).value),
                    "time": norm(ws.cell(rr, header.get("time", 0)).value),
                    "staff": [],
                }

                if header.get("staff"):
                    staff = norm(ws.cell(rr, header["staff"]).value)
                    if staff:
                        lab["staff"] = [staff]

                courses_map[course_code]["labs"].append(lab)
                rr += 1

            r = rr

    semester_ref.set(
        {
            "semester": int(semester),
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "courses": courses_map,
        },
        merge=False,
    )

# ==============================
# ENTRY POINT
# ==============================
if __name__ == "__main__":
    if len(sys.argv) < 5:
        raise Exception("Usage: labs_parser.py <file_path> <year_id> <year_label> <semester>")

    parse_workbook(
        Path(sys.argv[1]),
        sys.argv[2],
        sys.argv[3],
        sys.argv[4],
    )

    print("OK")
