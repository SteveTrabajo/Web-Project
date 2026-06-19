import express from "express";
import { sendWeeklyReport } from "../../services/scheduler.js";

const router = express.Router();

// POST /api/internal/run-report - triggered by the scheduled GitHub Action.
// Guarded by a static secret instead of a JWT so an automated caller can use it.
router.post("/run-report", async (req, res) => {
  if (req.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    await sendWeeklyReport();
    res.json({ ok: true });
  } catch (err) {
    console.error("cron report error:", err);
    res.status(500).json({ error: "report failed" });
  }
});

export default router;
