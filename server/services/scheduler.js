import { db } from "../server.js";
import { sendEmail } from "./mailer.js";
import {
  fetchFeedback,
  computeStats,
  renderReportHtml,
  feedbackToCsv,
  csvAttachment,
} from "./reportService.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Every admin gets the weekly report. This used to read a hardcoded "admin1"
// document, so any admin added later silently never received one.
export async function getAdminEmail() {
  const snap = await db.collection("admins").get();
  const emails = snap.docs.map((d) => d.data()?.email).filter(Boolean);
  return emails.length ? emails.join(", ") : null;
}

// Builds the weekly stats, attaches the week's feedback as CSV, and emails the admin.
export async function sendWeeklyReport() {
  const to = await getAdminEmail();
  if (!to) return;

  const from = new Date(Date.now() - WEEK_MS).toISOString();
  const items = await fetchFeedback({ from });
  const stats = computeStats(items);
  const html = renderReportHtml(stats, "שבועי");
  const csv = feedbackToCsv(items);

  await sendEmail({
    to,
    subject: "דוח שבועי - BIO-BOT 2.0",
    html,
    attachments: [csvAttachment(csv, "feedback-weekly.csv")],
  });
}
