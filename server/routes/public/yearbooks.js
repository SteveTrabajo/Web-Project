import express from "express";
import { db } from "../../server.js";

const router = express.Router();

router.get("/yearbooks", async (req, res) => {
  try {
    const snap = await db.collection("yearbooks").get();
    const yearbooks = snap.docs.map((doc) => ({
      id: doc.id,
      label: doc.data().displayName,
    }));
    res.json({ yearbooks });
  } catch {
    res.status(500).json({ error: "failed to load yearbooks" });
  }
});
router.get("/requiredcourses/:yearbookId/:semesterKey", async (req, res) => {
  try {
    const { yearbookId, semesterKey } = req.params;

    const coursesSnap = await db
      .collection("yearbooks")
      .doc(yearbookId)
      .collection("requiredCourses")
      .doc(semesterKey)
      .collection("courses")
      .get();

    const courses = [];

    for (const courseDoc of coursesSnap.docs) {
      const relSnap = await courseDoc.ref.collection("relations").get();
      courses.push({
        id: courseDoc.id,
        ...courseDoc.data(),
        relations: relSnap.docs.map((r) => ({ id: r.id, ...r.data() })),
      });
    }

    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
