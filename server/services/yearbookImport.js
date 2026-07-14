import { execFile } from "child_process";
import os from "os";
import { callLLMJson, IMPORT_MODEL } from "./llm.js";

/*
 * Yearbook import pipeline (extraction + LLM structuring).
 *
 * Flow:
 *   1. runExtractor()   - Python pulls raw tables out of the DOCX/PDF (no writes).
 *   2. structureTable() - gpt-4o turns one semester's raw rows into structured
 *                         courses with typed prerequisites / corequisites.
 *   3. buildPreview()   - assembles all semesters into a preview object for
 *                         admin review before anything touches the real data.
 *
 * Relation typing rule carried into the prompt: in the source yearbook, an
 * underlined course code in the relations column is a COREQUISITE (may be taken
 * in parallel); a plain code is a PREREQUISITE (must be completed first). The
 * extractor preserves underline as <u>...</u> markup so the model can see it.
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
        if (err) return reject(new Error(stderr || err.message));
        try {
          const parsed = JSON.parse(String(stdout).trim());
          if (parsed.error) return reject(new Error(parsed.error));
          resolve(parsed);
        } catch {
          reject(new Error("Extractor did not return valid JSON"));
        }
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
- The relations column lists other course codes this course depends on.
- CRITICAL relation typing:
  * A code wrapped in <u>...</u> is a COREQUISITE (may be taken in parallel).
  * A plain (non-underlined) code is a PREREQUISITE (must be completed first).
- Only include codes that literally appear in the row. Never invent codes or names.
- Credits/hours: parse numbers; use null when absent or "-".

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
      "corequisites": ["code", ...]
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
      semesterNumber,
    }));
}

// Layer 4: analysis pass. Over the FULL cross-semester course list, gpt-4o
// proposes relations the yearbook left implicit and flags anomalies. Output is
// advisory only - it becomes suggestions the admin approves before commit, so
// the bot still answers strictly from admin-confirmed data.
async function analyzeRelations(allCourses) {
  if (allCourses.length < 2) return { suggestions: [], anomalies: [] };

  const catalog = allCourses.map((c) => ({
    code: c.courseCode,
    name: c.courseName,
    semester: c.semesterNumber,
    prerequisites: c.prerequisites || [],
    corequisites: c.corequisites || [],
  }));

  const prompt = `You are auditing a Biotechnology degree's course dependency graph.
Below is the full course catalog with the prerequisites/corequisites already detected from the yearbook.

Your job:
1. Suggest MISSING relations that are strongly implied by course names, domain progression, and typical Biotech curricula (e.g. an advanced course that clearly builds on a foundational one).
2. Flag anomalies (e.g. an advanced-sounding course with zero prerequisites).

Hard rules:
- Only reference course codes that exist in the catalog. Never invent codes.
- A prerequisite must sit in an equal or earlier semester than the course that needs it.
- Be conservative: only suggest links you are reasonably confident about. Assign confidence honestly.
- Do NOT repeat relations already present.

Catalog:
${JSON.stringify(catalog, null, 0)}

Output JSON:
{
  "suggestions": [
    {
      "from": "code that should gain the relation",
      "to": "code of the prerequisite/corequisite",
      "type": "PREREQUISITE" | "COREQUISITE",
      "confidence": "high" | "medium" | "low",
      "reason": "short Hebrew explanation"
    }
  ],
  "anomalies": [
    { "code": "code", "issue": "short Hebrew explanation" }
  ]
}`;

  const result = await callLLMJson(prompt, { temperature: 0.2, model: IMPORT_MODEL });
  const codes = new Set(allCourses.map((c) => c.courseCode));
  const nameOf = new Map(allCourses.map((c) => [c.courseCode, c.courseName]));

  const suggestions = (result?.suggestions || [])
    .filter((s) => codes.has(String(s.from)) && codes.has(String(s.to)) && String(s.from) !== String(s.to))
    .map((s, i) => ({
      id: `sug_${i}`,
      from: String(s.from),
      fromName: nameOf.get(String(s.from)) || String(s.from),
      to: String(s.to),
      toName: nameOf.get(String(s.to)) || String(s.to),
      type: s.type === "COREQUISITE" ? "COREQUISITE" : "PREREQUISITE",
      confidence: ["high", "medium", "low"].includes(s.confidence) ? s.confidence : "low",
      reason: String(s.reason || "").slice(0, 300),
      approved: false,
    }));

  const anomalies = (result?.anomalies || [])
    .filter((a) => codes.has(String(a.code)))
    .map((a) => ({ code: String(a.code), name: nameOf.get(String(a.code)) || String(a.code), issue: String(a.issue || "").slice(0, 300) }));

  return { suggestions, anomalies };
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
  const looseJobs = (raw.looseTables || []).map((t) =>
    structureTable(null, t.headers, t.rows)
  );

  const [semesterResults, looseResults] = await Promise.all([
    Promise.all(semesterJobs),
    Promise.all(looseJobs),
  ]);

  const unassigned = looseResults.flat();
  if (unassigned.length) {
    warnings.push(`${unassigned.length} course(s) had no detected semester - assign one before committing.`);
  }

  // Layer 4 analysis over the full course list (advisory suggestions + anomalies).
  const allCourses = [...semesterResults.flatMap((s) => s.courses), ...unassigned];
  const { suggestions, anomalies } = await analyzeRelations(allCourses);

  const totalCourses = allCourses.length;

  return {
    yearbookId: yearbookId || null,
    label: label || null,
    format: raw.format,
    semesters: semesterResults.sort((a, b) => a.semesterNumber - b.semesterNumber),
    unassigned,
    suggestions,
    anomalies,
    warnings,
    stats: {
      totalCourses,
      semesters: semesterResults.length,
      suggestions: suggestions.length,
      anomalies: anomalies.length,
    },
  };
}
