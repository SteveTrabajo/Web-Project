import { execFile } from "child_process";
import os from "os";
import { callLLMJson, IMPORT_MODEL } from "./llm.js";

/*
 * Yearbook import pipeline (extraction + LLM structuring).
 *
 * Flow:
 *   1. runExtractor()   - Python pulls the per-semester course tables out of the
 *                         DOCX/PDF (no writes, prose/notes/electives skipped).
 *   2. structureTable() - the LLM turns one semester's raw rows into structured
 *                         courses with typed prerequisites / corequisites, and
 *                         reports any relation-column text it could NOT map to a
 *                         course code (unresolvedRelations).
 *   3. buildPreview()   - assembles all semesters into a preview object plus a
 *                         single review list of the relations the AI could not
 *                         resolve, for the admin to fix before anything is saved.
 *
 * Relation typing rule carried into the prompt: in the source yearbook, an
 * underlined course code in the relations column is a COREQUISITE (may be taken
 * in parallel); a plain code is a PREREQUISITE (must be completed first). The
 * DOCX extractor preserves underline as <u>...</u> so the model can see it; PDF
 * cannot carry underline, so the model types those by wording/position.
 */

const PYTHON_CMD = os.platform() === "win32" ? "py" : "python3";
const EXTRACTOR = "parsers/yearbook_extractor.py";

// Yearbook tables can be large; lift execFile's 1MB stdout cap.
const MAX_BUFFER = 25 * 1024 * 1024;

export function runExtractor(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_CMD,
      [EXTRACTOR, filePath],
      { maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        // The extractor reports its own errors as a JSON payload on stdout and
        // exits non-zero, so parse stdout FIRST - even on failure - to surface
        // the real reason (e.g. a missing dependency) instead of "Command failed".
        const out = String(stdout || "").trim();
        if (out) {
          try {
            const parsed = JSON.parse(out);
            if (parsed.error) return reject(new Error(parsed.error));
            return resolve(parsed);
          } catch {
            /* fall through to error handling below */
          }
        }
        if (err) return reject(new Error(stderr || err.message));
        reject(new Error("Extractor did not return valid JSON"));
      }
    );
  });
}

function buildStructurePrompt(semesterNumber, headers, rows) {
  return `You are extracting a Biotechnology yearbook course table into structured data.
Return STRICT JSON only.

Context:
- semesterNumber: ${semesterNumber === null ? "unknown" : semesterNumber}
- Each row is one course. Columns (Hebrew headers): ${JSON.stringify(headers)}
- A course code is a 5-6 digit number.
- The relations column lists other course codes this course depends on, usually as
  "<code> <course name>" pairs, one per line.
- CRITICAL relation typing:
  * A code wrapped in <u>...</u> is a COREQUISITE (may be taken in parallel).
  * A plain (non-underlined) code is a PREREQUISITE (must be completed first).
- Only include codes that literally appear in the row. Never invent codes or names.
- Credits/hours: parse numbers; use null when absent or "-".
- unresolvedRelations: if the relations column contains text that clearly refers to a
  prerequisite/corequisite but you CANNOT resolve it to a 5-6 digit course code
  (e.g. a condition like a psychometric score, or a course named with no code, or
  "all mandatory courses"), copy that raw text fragment here. Do NOT put resolved
  codes here. Return an empty array when everything mapped cleanly.
- Ignore summary/total rows (e.g. a "סה\"כ" row with no course code).

Rows (each is an array of cell strings, underline preserved as <u>..</u>):
${JSON.stringify(rows, null, 0)}

Output JSON shape:
{
  "courses": [
    {
      "courseCode": "12345",
      "courseName": "string",
      "credits": number|null,
      "lectureHours": number|null,
      "practiceHours": number|null,
      "labHours": number|null,
      "prerequisites": ["code", ...],
      "corequisites": ["code", ...],
      "unresolvedRelations": ["raw text", ...]
    }
  ]
}`;
}

async function structureTable(semesterNumber, headers, rows) {
  if (!rows || !rows.length) return [];
  const prompt = buildStructurePrompt(semesterNumber, headers, rows);
  const result = await callLLMJson(prompt, { temperature: 0, model: IMPORT_MODEL });
  const courses = Array.isArray(result?.courses) ? result.courses : [];

  // Normalize + attach the semester so the commit step can place each course.
  return courses
    .filter((c) => /^\d{5,6}$/.test(String(c.courseCode || "").trim()))
    .map((c) => ({
      courseCode: String(c.courseCode).trim(),
      courseName: String(c.courseName || "").trim(),
      credits: c.credits ?? null,
      lectureHours: c.lectureHours ?? null,
      practiceHours: c.practiceHours ?? null,
      labHours: c.labHours ?? null,
      prerequisites: (c.prerequisites || []).map((x) => String(x).trim()).filter((x) => /^\d{5,6}$/.test(x)),
      corequisites: (c.corequisites || []).map((x) => String(x).trim()).filter((x) => /^\d{5,6}$/.test(x)),
      unresolvedRelations: (c.unresolvedRelations || [])
        .map((x) => String(x || "").trim())
        .filter((x) => x.length >= 2)
        .slice(0, 10),
      semesterNumber,
    }));
}

// Builds the single "relations the AI could not resolve" review list. Two sources,
// both requiring an admin decision before the data is trusted:
//   - text the model flagged as an unmappable relation (unresolvedRelations)
//   - a prerequisite/corequisite code pointing at a course not in the catalog
//     (a dangling reference - likely an OCR/parse slip or an elective not imported)
function collectUnresolved(allCourses) {
  const codes = new Set(allCourses.map((c) => c.courseCode));
  const out = [];
  let n = 0;

  for (const c of allCourses) {
    for (const raw of c.unresolvedRelations || []) {
      out.push({
        id: `unres_${n++}`,
        fromCode: c.courseCode,
        fromName: c.courseName,
        semesterNumber: c.semesterNumber ?? null,
        rawText: raw,
        reason: "text",
        resolvedTo: "",
        resolvedType: "PREREQUISITE",
        dismissed: false,
      });
    }

    const dangling = [
      ...(c.prerequisites || []).map((code) => ({ code, type: "PREREQUISITE" })),
      ...(c.corequisites || []).map((code) => ({ code, type: "COREQUISITE" })),
    ].filter((r) => !codes.has(r.code));

    for (const r of dangling) {
      out.push({
        id: `unres_${n++}`,
        fromCode: c.courseCode,
        fromName: c.courseName,
        semesterNumber: c.semesterNumber ?? null,
        rawText: r.code,
        reason: "dangling",
        resolvedTo: "",
        resolvedType: r.type,
        dismissed: false,
      });
    }
  }
  return out;
}

// Runs extraction + LLM structuring and returns a preview (no Firestore writes).
export async function buildPreview(filePath, { yearbookId, label } = {}) {
  const raw = await runExtractor(filePath);
  const warnings = [...(raw.warnings || [])];

  // Structure every semester table concurrently.
  const semesterJobs = (raw.semesters || []).map((s) =>
    structureTable(s.semesterNumber, s.headers, s.rows).then((courses) => ({
      semesterNumber: s.semesterNumber,
      courses,
    }))
  );

  // Loose tables (no semester heading) structured with unknown semester so the
  // admin can assign one in review - never silently dropped.
  const looseJobs = (raw.looseTables || []).map((t) => structureTable(null, t.headers, t.rows));

  const [semesterResults, looseResults] = await Promise.all([
    Promise.all(semesterJobs),
    Promise.all(looseJobs),
  ]);

  const unassigned = looseResults.flat();
  if (unassigned.length) {
    warnings.push(`${unassigned.length} course(s) had no detected semester - assign one before committing.`);
  }

  const allCourses = [...semesterResults.flatMap((s) => s.courses), ...unassigned];
  const unresolvedRelations = collectUnresolved(allCourses);
  const totalCourses = allCourses.length;

  return {
    yearbookId: yearbookId || null,
    label: label || null,
    format: raw.format,
    semesters: semesterResults.sort((a, b) => a.semesterNumber - b.semesterNumber),
    unassigned,
    unresolvedRelations,
    warnings,
    stats: {
      totalCourses,
      semesters: semesterResults.length,
      unresolvedRelations: unresolvedRelations.length,
    },
  };
}
