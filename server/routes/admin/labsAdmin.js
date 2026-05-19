import express from "express";
import { db } from "../../server.js";

import admin from "firebase-admin";

const router = express.Router();

router.get("/labs/:yearbook/:semester", async (req, res) => {
  const { yearbook, semester } = req.params;

  const doc = await db
    .collection("lab_schedule")
    .doc(yearbook)
    .collection("semesters")
    .doc(String(semester))
    .get();

  if (!doc.exists) {
    return res.status(404).json({ error: "not found" });
  }

  res.json({ doc: doc.data() });
});

// Full replacement of a semester doc — intentional, not a partial update.
router.put("/labs/:yearbook/:semester", async (req, res) => {
  const { yearbook, semester } = req.params;

  const yearRef = db.collection("lab_schedule").doc(yearbook);
  const semRef = yearRef.collection("semesters").doc(String(semester));

 
  await yearRef.set(
    {
      year: req.body?.yearLabel || yearbook,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await semRef.set(
    {
      ...req.body,
      semester: Number(semester),
    },
    { merge: false }
  );

  res.json({ ok: true });
});

export default router;
