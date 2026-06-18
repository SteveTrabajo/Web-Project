import express from "express";
import { sendWeeklyReport } from "../../services/scheduler.js";

const router = express.Router();

// POST /api/admin/reports/run - send the weekly report on demand
router.post("/reports/run", async (req, res) => {
  try {
    await sendWeeklyReport();
    res.json({ ok: true });
  } catch (err) {
    console.error("manual report error:", err);
    res.status(500).json({ error: "שליחת הדוח נכשלה" });
  }
});

export default router;
