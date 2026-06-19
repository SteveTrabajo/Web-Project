import express from "express";
import { sendWeeklyReport, getAdminEmail } from "../../services/scheduler.js";
import { sendEmail } from "../../services/mailer.js";
import { fetchFeedback, feedbackToCsv, csvAttachment } from "../../services/reportService.js";

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

// POST /api/admin/feedback/export-email - email a filtered feedback CSV to the admin
router.post("/feedback/export-email", async (req, res) => {
  const { rating, from, to } = req.body ?? {};
  try {
    const adminEmail = await getAdminEmail();
    if (!adminEmail) return res.status(400).json({ error: "לא נמצא אימייל מנהל" });

    const items = await fetchFeedback({ rating, from, to });
    if (items.length === 0) return res.status(400).json({ error: "אין משובים לייצוא" });

    const csv = feedbackToCsv(items);
    const today = new Date().toISOString().slice(0, 10);

    await sendEmail({
      to: adminEmail,
      subject: "ייצוא משובים - BIO-BOT 2.0",
      html: `<div dir="rtl" style="font-family: Arial, sans-serif">
        <p>מצורף קובץ CSV עם ${items.length} משובים.</p>
      </div>`,
      attachments: [csvAttachment(csv, `feedback-${today}.csv`)],
    });

    res.json({ ok: true, count: items.length });
  } catch (err) {
    console.error("feedback export-email error:", err);
    res.status(500).json({ error: "שליחת הייצוא נכשלה" });
  }
});

export default router;
