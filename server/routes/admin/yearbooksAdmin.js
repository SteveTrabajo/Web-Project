import express from "express";
import { db } from "../../server.js";
import { invalidateYearbookCaches } from "../../services/courseData.js";


const router = express.Router();

// Admin – list yearbooks
router.get("/yearbooks", async (req, res) => {
  try {
    const snap = await db.collection("yearbooks").get();
    const yearbooks = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    res.json({ yearbooks });
  } catch (err) {
    res.status(500).json({ error: "failed" });
  }
});

/* =============================
   Delete a yearbook

   Destructive and irreversible: a yearbook owns
   requiredCourses/{semester}/courses/{code}/relations/{code}, four levels deep.
   Two endpoints so the admin sees the blast radius before confirming, and the
   delete itself requires the yearbook id echoed back in the body.
============================= */

// Counts what a delete would remove, plus data that references this yearbook
// but is NOT owned by it and would be left behind.
async function collectImpact(yearbookId) {
  const root = db.collection("yearbooks").doc(yearbookId);
  const [doc, semestersSnap] = await Promise.all([root.get(), root.collection("requiredCourses").get()]);
  if (!doc.exists) return null;

  let courses = 0;
  let relations = 0;
  const semesters = [];

  for (const sem of semestersSnap.docs) {
    const coursesSnap = await sem.ref.collection("courses").get();
    courses += coursesSnap.size;
    semesters.push({ key: sem.id, courses: coursesSnap.size });
    const relSnaps = await Promise.all(coursesSnap.docs.map((c) => c.ref.collection("relations").get()));
    relations += relSnaps.reduce((n, s) => n + s.size, 0);
  }

  // lab_schedule shares the yearbook id scheme (see routes/public/labs.js), so a
  // matching doc would be orphaned unless it is removed too.
  let labSemesters = 0;
  const labDoc = await db.collection("lab_schedule").doc(yearbookId).get();
  if (labDoc.exists) {
    const labSems = await labDoc.ref.collection("semesters").get();
    labSemesters = labSems.size;
  }

  // Curated answers scoped to this yearbook are admin-authored content, not
  // yearbook data. They are reported but never deleted automatically.
  let curatedAnswers = 0;
  try {
    const curated = await db.collection("curatedAnswers").where("yearbook", "==", yearbookId).get();
    curatedAnswers = curated.size;
  } catch {
    curatedAnswers = 0;
  }

  const total = await db.collection("yearbooks").get();

  return {
    yearbookId,
    displayName: doc.data()?.displayName || yearbookId,
    semesters,
    counts: { semesters: semestersSnap.size, courses, relations },
    labSchedule: { exists: labDoc.exists, semesters: labSemesters },
    curatedAnswers,
    isLastYearbook: total.size <= 1,
  };
}

router.get("/yearbooks/:yearbookId/delete-impact", async (req, res) => {
  try {
    const impact = await collectImpact(req.params.yearbookId);
    if (!impact) return res.status(404).json({ error: "השנתון לא נמצא." });
    res.json({ ok: true, impact });
  } catch (err) {
    console.error("yearbook delete-impact:", err);
    res.status(500).json({ error: "שגיאה בבדיקת השנתון" });
  }
});

router.delete("/yearbooks/:yearbookId", async (req, res) => {
  const { yearbookId } = req.params;
  const { confirm, deleteLabSchedule } = req.body || {};

  // The id must be echoed back, so a stray click cannot wipe a yearbook.
  if (confirm !== yearbookId) {
    return res.status(400).json({ error: "יש להקליד את מזהה השנתון לאישור המחיקה." });
  }

  try {
    const root = db.collection("yearbooks").doc(yearbookId);
    const doc = await root.get();
    if (!doc.exists) return res.status(404).json({ error: "השנתון לא נמצא." });

    const impact = await collectImpact(yearbookId);

    // recursiveDelete removes the document and every nested subcollection.
    await db.recursiveDelete(root);

    let labsDeleted = false;
    if (deleteLabSchedule === true) {
      const labRef = db.collection("lab_schedule").doc(yearbookId);
      if ((await labRef.get()).exists) {
        await db.recursiveDelete(labRef);
        labsDeleted = true;
      }
    }

    // Stop the bot serving this yearbook from cache for the rest of the TTL.
    invalidateYearbookCaches(yearbookId);

    res.json({
      ok: true,
      deleted: {
        yearbookId,
        semesters: impact?.counts.semesters ?? 0,
        courses: impact?.counts.courses ?? 0,
        relations: impact?.counts.relations ?? 0,
        labSchedule: labsDeleted,
      },
      orphanedCuratedAnswers: impact?.curatedAnswers ?? 0,
    });
  } catch (err) {
    console.error("yearbook delete:", err);
    res.status(500).json({ error: "שגיאה במחיקת השנתון" });
  }
});

export default router;
