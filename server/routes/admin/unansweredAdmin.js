import express from "express";
import { db } from "../../server.js";

const router = express.Router();

// GET /api/admin/unanswered-questions — JWT protected, paginated + optional date filters
// ?page=1&limit=20&from=ISO&to=ISO
router.get("/unanswered-questions", async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const { from, to } = req.query;
  const hasFilter = from || to;

  try {
    let query = db.collection("unansweredQuestions").orderBy("createdAt", "desc");
    if (from) query = query.where("createdAt", ">=", from);
    if (to)   query = query.where("createdAt", "<=", to);

    if (hasFilter) {
      // Fetch all matching docs when filters are active; no pagination needed
      const snap = await query.get();
      const questions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ questions, page: 1, limit: questions.length, hasMore: false });
    }

    const snap = await query.limit(limit).offset(offset).get();
    const questions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ questions, page, limit, hasMore: questions.length === limit });
  } catch (err) {
    console.error("unansweredAdmin GET error:", err);
    return res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// DELETE /api/admin/unanswered-questions/:id
router.delete("/unanswered-questions/:id", async (req, res) => {
  try {
    await db.collection("unansweredQuestions").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("unansweredAdmin DELETE error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
