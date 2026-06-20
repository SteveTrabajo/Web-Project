import express from "express";
import { db } from "../../server.js";

const router = express.Router();

router.get("/labs-years", async (req, res) => {
  try {
    const [labsSnap, yearbooksSnap] = await Promise.all([
      db.collection("lab_schedule").get(),
      db.collection("yearbooks").get(),
    ]);

    // Hebrew display names keyed by yearbook id (shared id scheme with lab_schedule)
    const hebrewById = new Map(
      yearbooksSnap.docs
        .map((d) => [d.id, d.data()?.displayName])
        .filter(([, name]) => name)
    );

    const years = labsSnap.docs.map((d) => {
      const stored = d.data()?.year;
      // Prefer a real stored Hebrew label, then the yearbook display name, then the id.
      const label =
        stored && stored !== d.id ? stored : hebrewById.get(d.id) || stored || d.id;
      return { id: d.id, label };
    });

    res.json({ years });
  } catch {
    res.status(500).json({ error: "failed" });
  }
});
router.get("/labs/:yearbook/:semester", async (req, res) => {
  const { yearbook, semester } = req.params;

  const doc = await db
    .collection("lab_schedule")
    .doc(yearbook)
    .collection("semesters")
    .doc(String(semester))
    .get();

  if (!doc.exists) return res.status(404).json({ error: "not found" });

  res.json(doc.data());
});

export default router;
