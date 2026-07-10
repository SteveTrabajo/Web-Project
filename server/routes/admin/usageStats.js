import express from "express";
import { db } from "../../server.js";

const router = express.Router();

// GET /api/admin/usage-stats
// Optional: ?days=7|30|90 — filters in memory after fetching last 1000 events
router.get("/usage-stats", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || null;

    // Fetch last 1000 usage events ordered by createdAt desc
    const eventsSnap = await db
      .collection("usageEvents")
      .orderBy("createdAt", "desc")
      .limit(1000)
      .get();

    let events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (days) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      events = events.filter((e) => e.createdAt >= since);
    }

    // Recent unanswered questions (last 20)
    const unansweredSnap = await db
      .collection("unansweredQuestions")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const recentUnanswered = unansweredSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        question: (data.questions || [])[0] || "",
        yearbook: data.yearbook || null,
        semester: data.semester || null,
        topic: data.topic || null,
        createdAt: data.createdAt,
      };
    });

    // Feedback summary (last 500)
    const feedbackSnap = await db
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const feedbacks = feedbackSnap.docs.map((d) => d.data());

    // --- Aggregate events ---
    const totalQuestions = events.length;
    const answeredQuestions = events.filter((e) => e.wasAnswered).length;
    const unansweredQuestionsCount = events.filter((e) => !e.wasAnswered).length;
    const answerRate = totalQuestions
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;

    const semesterCounts = {};
    const topicCounts = {};
    const sourceCounts = {};
    const courseCounts = {};
    const unansweredReasonCounts = {};

    for (const e of events) {
      const sem = e.semester || "לא ידוע";
      semesterCounts[sem] = (semesterCounts[sem] || 0) + 1;

      const topic = e.topic || "אחר";
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;

      const src = e.answerSource || "unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      // Why questions went unanswered - actionable for admins (kb_miss = add content).
      if (!e.wasAnswered) {
        unansweredReasonCounts[src] = (unansweredReasonCounts[src] || 0) + 1;
      }

      for (const code of e.detectedCourses || []) {
        courseCounts[code] = (courseCounts[code] || 0) + 1;
      }
    }

    const bySemester = Object.entries(semesterCounts)
      .map(([semester, count]) => ({ semester, count }))
      .sort((a, b) => b.count - a.count);

    const byTopic = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);

    const byAnswerSource = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const unansweredByReason = Object.entries(unansweredReasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const topCourses = Object.entries(courseCounts)
      .map(([course, count]) => ({ course, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Feedback summary ---
    const totalFeedback = feedbacks.length;
    const positive = feedbacks.filter((f) => f.rating === "positive").length;
    const negative = feedbacks.filter((f) => f.rating === "negative").length;

    const reasonCounts = {};
    feedbacks
      .filter((f) => f.rating === "negative")
      .forEach((f) => {
        for (const r of f.reasons || []) {
          reasonCounts[r] = (reasonCounts[r] || 0) + 1;
        }
      });

    const negativeReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      totalQuestions,
      answeredQuestions,
      unansweredQuestions: unansweredQuestionsCount,
      answerRate,
      bySemester,
      byTopic,
      byAnswerSource,
      unansweredByReason,
      topCourses,
      recentUnanswered,
      feedbackSummary: {
        totalFeedback,
        positive,
        negative,
        negativeReasons,
      },
    });
  } catch (err) {
    console.error("USAGE STATS ERROR:", err);
    return res.status(500).json({ error: "שגיאה בטעינת הסטטיסטיקות" });
  }
});

export default router;
