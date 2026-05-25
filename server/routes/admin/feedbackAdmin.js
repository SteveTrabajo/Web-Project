import express from "express";
import { db } from "../../server.js";

const router = express.Router();

// GET /api/admin/feedback — JWT protected, paginated
router.get("/feedback", async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  try {
    const snap = await db
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .get();

    const feedback = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ feedback, page, limit, hasMore: feedback.length === limit });
  } catch (err) {
    console.error("feedbackAdmin GET error:", err);
    return res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
