import express from "express";
import { db } from "../../server.js";

const router = express.Router();

router.get("/labs-years", async (req, res) => {
  try {
    const snap = await db.collection("lab_schedule").get();
    const years = snap.docs.map((d) => ({
      id: d.id,
      label: d.data()?.year || d.id,
    }));
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
