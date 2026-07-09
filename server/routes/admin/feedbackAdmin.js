import express from "express";
import { db } from "../../server.js";

const router = express.Router();

// GET /api/admin/feedback — JWT protected, paginated + optional filters
// ?page=1&limit=20&rating=positive|negative&from=ISO&to=ISO
router.get("/feedback", async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const { rating, from, to } = req.query;
  const hasFilter = from || to || (rating && rating !== "all");

  try {
    let query = db.collection("feedback").orderBy("createdAt", "desc");
    if (from) query = query.where("createdAt", ">=", from);
    if (to)   query = query.where("createdAt", "<=", to);

    if (hasFilter) {
      // Fetch all matching docs when filters are active; no pagination needed
      const snap = await query.get();
      let feedback = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (rating && rating !== "all") {
        feedback = feedback.filter((f) => f.rating === rating);
      }
      return res.json({ feedback, page: 1, limit: feedback.length, hasMore: false });
    }

    const snap = await query.limit(limit).offset(offset).get();
    const feedback = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ feedback, page, limit, hasMore: feedback.length === limit });
  } catch (err) {
    console.error("feedbackAdmin GET error:", err);
    return res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// DELETE /api/admin/feedback/:id
router.delete("/feedback/:id", async (req, res) => {
  try {
    await db.collection("feedback").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("feedbackAdmin DELETE error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
