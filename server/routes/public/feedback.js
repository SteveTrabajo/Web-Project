import express from "express";
import { db } from "../../server.js";

const router = express.Router();

const VALID_RATINGS = new Set(["positive", "negative"]);
const VALID_REASONS = new Set([
  "insufficient", "unclear", "irrelevant", "outdated", "missing_topic", "other",
]);

// POST /api/feedback — anonymous, no auth required
router.post("/feedback", async (req, res) => {
  const { rating, reasons, comment, questions, yearbook } = req.body ?? {};

  if (!VALID_RATINGS.has(rating)) {
    return res.status(400).json({ error: "דירוג לא חוקי" });
  }

  const cleanReasons = (Array.isArray(reasons) ? reasons : [])
    .filter((r) => typeof r === "string" && VALID_REASONS.has(r))
    .slice(0, 5);

  const cleanComment =
    typeof comment === "string" ? comment.trim().slice(0, 500) : "";

  // Last typed questions of the session, kept for the admin "unanswered" dashboard.
  const cleanQuestions = (Array.isArray(questions) ? questions : [])
    .filter((q) => typeof q === "string")
    .map((q) => q.trim().slice(0, 1000))
    .filter(Boolean)
    .slice(-5);

  const cleanYearbook =
    typeof yearbook === "string" ? yearbook.trim().slice(0, 100) : "";

  try {
    const createdAt = new Date().toISOString();

    await db.collection("feedback").add({
      rating,
      reasons: cleanReasons,
      comment: cleanComment,
      createdAt,
    });

    if (rating === "negative" && cleanQuestions.length > 0) {
      await db.collection("unansweredQuestions").add({
        questions: cleanQuestions,
        yearbook: cleanYearbook || null,
        reasons: cleanReasons,
        comment: cleanComment,
        createdAt,
      });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("feedback POST error:", err);
    return res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
