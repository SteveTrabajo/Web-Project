import express from "express";
import { db } from "../../server.js"; 


const router = express.Router();

// GET registration guidelines by semester
router.get("/:semester", async (req, res) => {
  try {
    const semester = Number(req.params.semester);
    const docId = `semester_${semester}`;

    const snap = await db
      .collection("registrationGuidelines")
      .doc(docId)
      .get();

    return res.json({ ok: true, doc: snap.exists ? snap.data() : null });
  } catch (e) {
    console.error("GET reg guidelines:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// PUT/save registration guidelines for a semester
router.put("/:semester", async (req, res) => {
  try {
    const semester = Number(req.params.semester);
    const docId = `semester_${semester}`;
    const body = req.body || {};

    body.semesterNumber = semester;

    await db
      .collection("registrationGuidelines")
      .doc(docId)
      .set(body, { merge: true });

    return res.json({ ok: true });
  } catch (e) {
    console.error("PUT reg guidelines:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;

