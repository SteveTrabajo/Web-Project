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

// ======================
// Upload yearbook (STEP 1 - preview only)
// Extracts + LLM-structures the file into a preview and stages it in Firestore.
// Writes NOTHING to the live yearbook data - the admin commits separately.
// ======================
router.post("/upload/yearbook", upload.single("file"), async (req, res) => {
  const { yearbookId, yearbookLabel } = req.body;
  const filePath = req.file?.path;

  if (!filePath) return res.status(400).json({ error: "No file uploaded" });

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".docx" && ext !== ".pdf") {
    cleanupFile(filePath);
    return res.status(400).json({ error: "Unsupported file type. Upload a DOCX or PDF." });
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
    console.error("Yearbook preview failed:", e.message);
    res.status(500).json({ error: "Yearbook extraction failed", details: e.message });
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
    return res.status(400).json({ error: "Missing yearbookId in preview" });
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
      error: "Some courses have no valid semester assigned",
      courses: unplaced.map((c) => `${c.courseCode} ${c.courseName}`),
    });
  }

  // Layer 4: fold admin-approved suggestions into the relations so the closure
  // and writes include them. Unapproved suggestions are discarded - the bot only
  // ever sees admin-confirmed data.
  const approved = (preview.suggestions || []).filter((s) => s.approved);
  if (approved.length) {
    const byCode = new Map(allCourses.map((c) => [c.courseCode, c]));
    for (const s of approved) {
      const course = byCode.get(s.from);
      if (!course) continue;
      const bucket = s.type === "COREQUISITE" ? "corequisites" : "prerequisites";
      course[bucket] = Array.from(new Set([...(course[bucket] || []), s.to]));
    }
  }

  try {
    const stats = await writeYearbook(preview.yearbookId, preview.label, allCourses);

    if (importId) {
      await db.collection("yearbookImports").doc(importId).set(
        {
          status: "committed",
          committedAt: admin.firestore.FieldValue.serverTimestamp(),
          approvedSuggestions: approved.length,
        },
        { merge: true }
      );
    }

    res.json({ ok: true, stats: { ...stats, appliedSuggestions: approved.length } });
  } catch (e) {
    console.error("Yearbook commit failed:", e.message);
    res.status(500).json({ error: "Yearbook commit failed", details: e.message });
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

    const rels = [
      ...(c.prerequisites || []).map((code) => ({ code, type: "PREREQUISITE" })),
      ...(c.corequisites || []).map((code) => ({ code, type: "COREQUISITE" })),
    ];
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
  if (!filePath) return res.status(400).json({ error: "No file uploaded" });

  execFile(
    PYTHON_CMD,
    ["parsers/labs_parser.py", filePath, "--dry-run"],
    (err, stdout, stderr) => {
      cleanupFile(filePath);
      if (err) {
        console.error(stderr || err.message);
        return res.status(500).json({ error: "Labs parser failed", details: stderr || err.message });
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
