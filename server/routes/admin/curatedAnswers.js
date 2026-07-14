import express from "express";
import { db } from "../../server.js";
import { toSafeHtml, cleanKeywords, cleanYearbook } from "../../services/curatedAnswersUtil.js";

const router = express.Router();

// GET /api/admin/curated-answers?page=1&limit=50
router.get("/curated-answers", async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  try {
    const snap = await db
      .collection("curatedAnswers")
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .get();
    const answers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ answers, page, limit, hasMore: answers.length === limit });
  } catch (err) {
    console.error("curatedAnswers GET error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// POST /api/admin/curated-answers - publish a new answer and resolve its source question
router.post("/curated-answers", async (req, res) => {
  const { question, answerText, keywords, yearbook, status, sourceId } = req.body ?? {};

  if (typeof answerText !== "string" || !answerText.trim()) {
    return res.status(400).json({ error: "חסרה תשובה" });
  }

  const now = new Date().toISOString();

  try {
    const ref = await db.collection("curatedAnswers").add({
      question:   typeof question === "string" ? question.trim().slice(0, 1000) : "",
      answerText: answerText.trim().slice(0, 5000),
      answerHtml: toSafeHtml(answerText),
      keywords:   cleanKeywords(keywords),
      yearbook:   cleanYearbook(yearbook),
      status:     status === "draft" ? "draft" : "published",
      sourceId:   typeof sourceId === "string" ? sourceId : null,
      createdAt:  now,
      updatedAt:  now,
    });

    // Resolve the originating unanswered question, if one was provided.
    if (typeof sourceId === "string" && sourceId) {
      await db.collection("unansweredQuestions").doc(sourceId).delete().catch(() => {});
    }

    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("curatedAnswers POST error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// PUT /api/admin/curated-answers/:id - edit fields / toggle publish state
router.put("/curated-answers/:id", async (req, res) => {
  const { question, answerText, keywords, yearbook, status } = req.body ?? {};
  const patch = { updatedAt: new Date().toISOString() };

  if (typeof question === "string") patch.question = question.trim().slice(0, 1000);
  if (typeof answerText === "string" && answerText.trim()) {
    patch.answerText = answerText.trim().slice(0, 5000);
    patch.answerHtml = toSafeHtml(answerText);
  }
  if (keywords !== undefined) patch.keywords = cleanKeywords(keywords);
  if (yearbook !== undefined) patch.yearbook = cleanYearbook(yearbook);
  if (status === "draft" || status === "published") patch.status = status;

  try {
    await db.collection("curatedAnswers").doc(req.params.id).set(patch, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("curatedAnswers PUT error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// DELETE /api/admin/curated-answers/:id
router.delete("/curated-answers/:id", async (req, res) => {
  try {
    await db.collection("curatedAnswers").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("curatedAnswers DELETE error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
