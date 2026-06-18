import { db } from "../server.js";

// Aggregates feedback created since the given timestamp into a stats object.
export async function buildReportStats(sinceMs) {
  const sinceIso = new Date(sinceMs).toISOString();

  const snap = await db
    .collection("feedback")
    .where("createdAt", ">=", sinceIso)
    .get();

  const items = snap.docs.map((d) => d.data());
  const total = items.length;
  const positive = items.filter((f) => f.rating === "positive").length;
  const negative = total - positive;
  const satisfaction = total ? Math.round((positive / total) * 100) : 0;

  const reasonCounts = {};
  for (const f of items) {
    for (const r of f.reasons || []) {
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    }
  }

  return { total, positive, negative, satisfaction, reasonCounts };
}

export function renderReportHtml(stats, periodLabel) {
  const reasonRows = Object.entries(stats.reasonCounts)
    .map(([reason, count]) => `<li>${reason}: ${count}</li>`)
    .join("");

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif">
      <h2>דוח ${periodLabel} - BIO-BOT 2.0</h2>
      <p>סך הכל משובים: ${stats.total}</p>
      <p>חיוביים: ${stats.positive} | שליליים: ${stats.negative}</p>
      <p>שביעות רצון: ${stats.satisfaction}%</p>
      <h3>פילוח סיבות למשוב שלילי</h3>
      <ul>${reasonRows || "<li>אין נתונים בתקופה זו</li>"}</ul>
    </div>
  `;
}
