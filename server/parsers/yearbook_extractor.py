import sys
import os
import re
import json

"""
yearbook_extractor.py

Raw content extractor for yearbook files (DOCX or PDF). This does NOT write to
Firestore and does NOT decide course relations - it only pulls the document's
tabular content out into a normalized JSON structure. The Node layer sends that
structure to the LLM for full structured extraction (see services/yearbookImport.js).

For DOCX, underlined runs in a cell are wrapped in <u>...</u> so the LLM can still
see the yearbook's "underline = corequisite" convention. PDF cells are plain text
(underline is not reliably recoverable from PDF).

Output: a single JSON object printed to stdout:
{
  "format": "docx" | "pdf",
  "semesters": [
    { "semesterNumber": 1, "headers": [...], "rows": [[cell, cell, ...], ...] }
  ],
  "looseTables": [ { "headers": [...], "rows": [...] } ],   # tables with no semester heading
  "warnings": [ "..." ]
}

Usage: python yearbook_extractor.py <file_path>
"""

SEM_RE = re.compile(r"סמסטר\s*([1-8])")


def normalize(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip()


# ==============================
# DOCX extraction
# ==============================
def render_cell_docx(cell):
    """Render a DOCX cell to text, wrapping underlined runs in <u>...</u> so the
    corequisite signal survives into the plain-text sent to the LLM."""
    parts = []
    for p in cell.paragraphs:
        line = []
        for run in p.runs:
            text = run.text
            if not text:
                continue
            if run.font.underline:
                line.append(f"<u>{text}</u>")
            else:
                line.append(text)
        para = normalize("".join(line))
        if para:
            parts.append(para)
    return " | ".join(parts)


def extract_docx(file_path):
    from docx import Document

    doc = Document(file_path)
    table_map = {t._element: t for t in doc.tables}

    semesters = []
    loose_tables = []
    warnings = []
    current_sem = None
    sem_bucket = {}

    def bucket_for(sem):
        if sem not in sem_bucket:
            entry = {"semesterNumber": sem, "headers": [], "rows": []}
            sem_bucket[sem] = entry
            semesters.append(entry)
        return sem_bucket[sem]

    for block in doc.element.body:
        if block.tag.endswith("p"):
            text = normalize("".join(t.text for t in block.xpath(".//w:t")))
            m = SEM_RE.search(text)
            if m:
                current_sem = int(m.group(1))
        elif block.tag.endswith("tbl"):
            table = table_map.get(block)
            if not table or not table.rows:
                continue
            headers = [normalize(c.text) for c in table.rows[0].cells]
            rows = []
            for row in table.rows[1:]:
                rows.append([render_cell_docx(c) for c in row.cells])
            if not rows:
                continue
            if current_sem is not None:
                entry = bucket_for(current_sem)
                if not entry["headers"]:
                    entry["headers"] = headers
                entry["rows"].extend(rows)
            else:
                loose_tables.append({"headers": headers, "rows": rows})

    if not semesters and not loose_tables:
        warnings.append("No tables detected in DOCX.")
    if loose_tables:
        warnings.append(f"{len(loose_tables)} table(s) had no detectable semester heading.")

    return {"format": "docx", "semesters": semesters, "looseTables": loose_tables, "warnings": warnings}


# ==============================
# PDF extraction
# ==============================
def extract_pdf(file_path):
    import pdfplumber

    semesters = []
    loose_tables = []
    warnings = []
    sem_bucket = {}

    def bucket_for(sem):
        if sem not in sem_bucket:
            entry = {"semesterNumber": sem, "headers": [], "rows": []}
            sem_bucket[sem] = entry
            semesters.append(entry)
        return sem_bucket[sem]

    with pdfplumber.open(file_path) as pdf:
        current_sem = None
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            # A page may open a new semester section; take the last heading on the page.
            headings = SEM_RE.findall(page_text)
            if headings:
                current_sem = int(headings[-1])

            tables = page.extract_tables() or []
            for tbl in tables:
                cleaned = [[normalize(c or "") for c in row] for row in tbl if any((c or "").strip() for c in row)]
                if not cleaned:
                    continue
                headers = cleaned[0]
                rows = cleaned[1:]
                if not rows:
                    continue
                if current_sem is not None:
                    entry = bucket_for(current_sem)
                    if not entry["headers"]:
                        entry["headers"] = headers
                    entry["rows"].extend(rows)
                else:
                    loose_tables.append({"headers": headers, "rows": rows})

    if not semesters and not loose_tables:
        warnings.append("No tables detected in PDF (it may be scanned/image-based).")
    if loose_tables:
        warnings.append(f"{len(loose_tables)} table(s) had no detectable semester heading.")

    return {"format": "pdf", "semesters": semesters, "looseTables": loose_tables, "warnings": warnings}


# ==============================
# Entry point
# ==============================
def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: yearbook_extractor.py <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".docx":
            result = extract_docx(file_path)
        elif ext == ".pdf":
            result = extract_pdf(file_path)
        else:
            print(json.dumps({"error": f"Unsupported file type: {ext}. Use .docx or .pdf"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Extraction failed: {e}"}))
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
