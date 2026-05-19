import express from "express";
import { db } from "../../server.js";


const router = express.Router();

// ---- list courses ----
router.get(
  "/yearbooks/:yearbookId/requiredCourses/:semesterKey/courses",
  async (req, res) => {
    try {
      const { yearbookId, semesterKey } = req.params;

      const snap = await db
        .collection("yearbooks")
        .doc(yearbookId)
        .collection("requiredCourses")
        .doc(semesterKey)
        .collection("courses")
        .get();

      const courses = await Promise.all(
        snap.docs.map(async (doc) => {
          const relSnap = await doc.ref.collection("relations").get();

          return {
            courseCode: doc.id,
            ...doc.data(),
            relations: relSnap.docs.map((r) => r.data()),
          };
        })
      );

      res.json({ courses });
    } catch (err) {
      console.error("LOAD COURSES ERROR:", err);
      res.status(500).json({ error: "failed" });
    }
  }
);

// ---- upsert course ----
router.put(
  "/yearbooks/:yearbookId/requiredCourses/:semesterKey/courses/:courseCode",
  async (req, res) => {
    try {
      const { yearbookId, semesterKey, courseCode } = req.params;
      const { relations = [], ...fields } = req.body;

      const courseRef = db
        .collection("yearbooks")
        .doc(yearbookId)
        .collection("requiredCourses")
        .doc(semesterKey)
        .collection("courses")
        .doc(courseCode);

      await courseRef.set({ courseCode, ...fields }, { merge: true });

      const relSnap = await courseRef.collection("relations").get();
      const batch = db.batch();
      relSnap.docs.forEach((d) => batch.delete(d.ref));

      relations.forEach((r) => {
        batch.set(
          courseRef.collection("relations").doc(String(r.courseCode)),
          {
            courseCode: String(r.courseCode),
            courseName: r.courseName || null,
            type: r.type || "PREREQUISITE",
          }
        );
      });

      await batch.commit();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "failed" });
    }
  }
);

// ---- delete course ----
router.delete(
  "/yearbooks/:yearbookId/requiredCourses/:semesterKey/courses/:courseCode",
  async (req, res) => {
    try {
      const { yearbookId, semesterKey, courseCode } = req.params;

      const courseRef = db
        .collection("yearbooks")
        .doc(yearbookId)
        .collection("requiredCourses")
        .doc(semesterKey)
        .collection("courses")
        .doc(courseCode);

      const relSnap = await courseRef.collection("relations").get();
      const batch = db.batch();
      relSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(courseRef);
      await batch.commit();

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "failed" });
    }
  }
);

export default router;
