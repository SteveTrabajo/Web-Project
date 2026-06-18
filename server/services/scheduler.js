import { db } from "../server.js";
import { transporter } from "./mailer.js";
import { buildReportStats, renderReportHtml } from "./reportService.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_ID = "admin1";

async function getAdminEmail() {
  const snap = await db.collection("admins").doc(ADMIN_ID).get();
  return snap.exists ? snap.data().email : null;
}

// Builds the weekly stats and emails them to the current admin.
export async function sendWeeklyReport() {
  const to = await getAdminEmail();
  if (!to) return;

  const stats = await buildReportStats(Date.now() - WEEK_MS);
  const html = renderReportHtml(stats, "שבועי");

  await transporter.sendMail({
    from: "BIO-BOT",
    to,
    subject: "דוח שבועי - BIO-BOT 2.0",
    html,
  });
}
