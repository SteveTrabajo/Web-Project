import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import admin from "firebase-admin";
import { db } from "../../server.js";
import { buildPreview } from "../../services/yearbookImport.js";
import { computeTransitiveClosure } from "../../services/prereqGraph.js";

const router = express.Router();

// "py" on Windows, "python3" on Linux/Render
const PYTHON_CMD = os.platform() === "win32" ? "py" : "python3";

// ======================
// Multer setup
// ======================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

function cleanupFile(filePath) {
  fs.unlink(filePath, () => {});
}

// Maps a raw/technical error to a short, actionable Hebrew message for the admin.
// The full technical text is logged server-side; the admin never sees a traceback.
function friendlyError(raw = "") {
  const m = String(raw).toLowerCase();
  if (m.includes("no module named") || m.includes("cannot import") || m.includes("modulenotfound")) {
    return "רכיב עיבוד בשרת אינו מותקן. יש לפנות למנהל המערכת.";
  }
  if (m.includes("no course tables") || m.includes("scanned") || m.includes("image-based")) {
    return "לא נמצאו טבלאות קורסים בקובץ. ודא/י שהקובץ מכיל טבלאות קורסים ואינו סרוק (תמונה).";
  }
  if (m.includes("limit is") || m.includes("too large") || m.includes("pages")) {
    return "הקובץ גדול מדי. יש להעלות קובץ המכיל רק את עמודי טבלאות הקורסים (עד 20 עמודים).";
  }
  if (m.includes("unsupported file type")) {
    return "יש להעלות קובץ מסוג DOCX או PDF בלבד.";
  }
  if (m.includes("openai") || m.includes("fetch") || m.includes("timeout") || m.includes("econn")) {
    return "שירות הניתוח (AI) אינו זמין כרגע. נסה/י שוב בעוד מספר רגעים.";
  }
  if (m.includes("valid json") || m.includes("extractor") || m.includes("parse")) {
    return "לא ניתן לקרוא את תוכן הקובץ. ודא/י שהקובץ תקין ונסה/י שוב.";
  }
  return "אירעה תקלה בעיבוד הקובץ. נסה/י שוב, ואם התקלה חוזרת פנה/י לתמיכה.";
}

// ======================
// Upload yearbook (STEP 1 - preview only)
// Extracts + LLM-structures the file into a preview and stages it in Firestore.
// Writes NOTHING to the live yearbook data - the admin commits separately.
// ======================
router.post("/upload/yearbook", upload.single("file"), async (req, res) => {
  const { yearbookId, yearbookLabel } = req.body;
  const filePath = req.file?.path;

  if (!filePath) return res.status(400).json({ error: "לא נבחר קובץ להעלאה." });

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".docx" && ext !== ".pdf") {
    cleanupFile(filePath);
    return res.status(400).json({ error: "יש להעלות קובץ מסוג DOCX או PDF בלבד." });
  }

  try {
    const preview = await buildPreview(filePath, { yearbookId, label: yearbookLabel });
    const importId = randomUUID();

    // Store only metadata - the full preview can approach Firestore's 1 MiB
    // doc limit, so the client holds it and sends it back on commit.
    await db.collection("yearbookImports").doc(importId).set({
      importId,
      yearbookId: yearbookId || null,
      label: yearbookLabel || null,
      status: "preview",
      stats: preview.stats,
      warnings: preview.warnings,
      format: preview.format,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true, importId, preview });
  } catch (e) {
    console.error("Yearbook preview failed:", e.message); // full detail stays in logs
    res.status(500).json({ error: friendlyError(e.message) });
  } finally {
    cleanupFile(filePath);
  }
});

// ======================
// Commit yearbook (STEP 2 - writes the reviewed preview to live data)
// Own body parser: a full reviewed import exceeds the global 10kb limit.
// server.js routes "/yearbook/commit" past the global parser for this reason.
// ======================
router.post("/upload/yearbook/commit", express.json({ limit: "8mb" }), async (req, res) => {
  const { importId, preview } = req.body || {};
  if (!preview?.yearbookId) {
    return res.status(400).json({ error: "חסר מזהה שנתון. חזור/י לשלב ההעלאה ונסה/י שוב." });
  }

  // Flatten every course, each carrying its semester. Reject anything unplaced.
  const allCourses = [];
  for (const sem of preview.semesters || []) {
    for (const c of sem.courses || []) {
      allCourses.push({ ...c, semesterNumber: c.semesterNumber ?? sem.semesterNumber });
    }
  }
  for (const c of preview.unassigned || []) allCourses.push(c);

  const unplaced = allCourses.filter((c) => !Number.isInteger(c.semesterNumber) || c.semesterNumber < 1 || c.semesterNumber > 8);
  if (unplaced.length) {
    return res.status(400).json({
      error: `יש לשייך סמסטר ל-${unplaced.length} קורסים לפני השמירה.`,
      courses: unplaced.map((c) => `${c.courseCode} ${c.courseName}`),
    });
  }

  // Fold admin-resolved relations (from the "AI could not resolve" review list)
  // into the course relations, so the closure and writes include them. Entries
  // the admin dismissed or left unresolved are discarded - the bot only ever
  // sees admin-confirmed data.
  const codeSet = new Set(allCourses.map((c) => c.courseCode));
  const resolved = (preview.unresolvedRelations || []).filter(
    (u) => !u.dismissed && codeSet.has(String(u.resolvedTo || "").trim())
  );
  if (resolved.length) {
    const byCode = new Map(allCourses.map((c) => [c.courseCode, c]));
    for (const u of resolved) {
      const course = byCode.get(u.fromCode);
      if (!course) continue;
      const bucket = u.resolvedType === "COREQUISITE" ? "corequisites" : "prerequisites";
      course[bucket] = Array.from(new Set([...(course[bucket] || []), String(u.resolvedTo).trim()]));
    }
  }

  // Prune dangling relations (targets not in the catalog) from every course so
  // neither the transitive closure nor the writes carry broken links. Anything
  // the admin wanted to keep was folded in above via resolvedTo (a catalog code).
  for (const c of allCourses) {
    c.prerequisites = (c.prerequisites || []).filter((code) => codeSet.has(code));
    c.corequisites = (c.corequisites || []).filter((code) => codeSet.has(code));
  }

  try {
    const stats = await writeYearbook(preview.yearbookId, preview.label, allCourses);

    if (importId) {
      await db.collection("yearbookImports").doc(importId).set(
        {
          status: "committed",
          committedAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedRelations: resolved.length,
        },
        { merge: true }
      );
    }

    res.json({
      ok: true,
      stats: { ...stats, resolvedRelations: resolved.length },
    });
  } catch (e) {
    console.error("Yearbook commit failed:", e.message); // full detail stays in logs
    res.status(500).json({ error: friendlyError(e.message) });
  }
});

// Writes courses + typed relations to Firestore in chunked batches.
async function writeYearbook(yearbookId, label, courses) {
  const nameMap = new Map(courses.map((c) => [c.courseCode, c.courseName]));

  // Layer 3: precompute the full prerequisite chain per course so the bot reads
  // it directly instead of walking the graph at query time.
  const { closureByCode, cycles } = computeTransitiveClosure(courses);

  const root = db.collection("yearbooks").doc(yearbookId);
  await root.set({ yearbookId, displayName: label || yearbookId }, { merge: true });

  const required = root.collection("requiredCourses");
  const semesters = new Set();

  // Chunk writes: Firestore caps a batch at 500 ops.
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
  };
  const stage = async (ref, data, opts) => {
    batch.set(ref, data, opts || {});
    if (++ops >= 450) await flush();
  };

  let relationCount = 0;
  for (const c of courses) {
    const semKey = `semester_${c.semesterNumber}`;
    if (!semesters.has(c.semesterNumber)) {
      await stage(required.doc(semKey), { semesterNumber: c.semesterNumber }, { merge: true });
      semesters.add(c.semesterNumber);
    }

    const courseRef = required.doc(semKey).collection("courses").doc(c.courseCode);
    await stage(
      courseRef,
      {
        courseCode: c.courseCode,
        courseName: c.courseName,
        credits: c.credits ?? null,
        lectureHours: c.lectureHours ?? null,
        practiceHours: c.practiceHours ?? null,
        labHours: c.labHours ?? null,
        transitivePrerequisites: closureByCode.get(c.courseCode) || [],
      },
      { merge: true }
    );

    // Skip relations whose target course was not imported (dangling reference) -
    // these are surfaced in the preview review list, never written as broken links.
    const rels = [
      ...(c.prerequisites || []).map((code) => ({ code, type: "PREREQUISITE" })),
      ...(c.corequisites || []).map((code) => ({ code, type: "COREQUISITE" })),
    ].filter((r) => nameMap.has(r.code));
    for (const r of rels) {
      await stage(
        courseRef.collection("relations").doc(r.code),
        { courseCode: r.code, courseName: nameMap.get(r.code) || null, type: r.type },
        { merge: true }
      );
      relationCount++;
    }
  }
  await flush();

  return {
    courses: courses.length,
    relations: relationCount,
    semesters: semesters.size,
    cycles: cycles.length,
  };
}

// ======================
// Upload labs (preview only - unchanged)
// ======================
router.post("/upload/labs", upload.single("file"), (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) return res.status(400).json({ error: "לא נבחר קובץ להעלאה." });

  execFile(
    PYTHON_CMD,
    ["parsers/labs_parser.py", filePath, "--dry-run"],
    (err, stdout, stderr) => {
      cleanupFile(filePath);
      if (err) {
        console.error(stderr || err.message); // full detail stays in logs
        return res.status(500).json({ error: friendlyError(stderr || err.message) });
      }

      let report = null;
      let courses = null;
      try {
        const lines = stdout.trim().split(/\r?\n/);
        const payload = JSON.parse(lines[lines.length - 1]);
        report = payload.report || null;
        courses = payload.courses || null;
      } catch {
        console.error("Failed to parse labs parser output");
      }

      res.json({ ok: true, report, courses });
    }
  );
});

export default router;
