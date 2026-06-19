import { db } from "../server.js";

const REASON_LABELS = {

  insufficient:  "מידע לא מספיק",
  unclear:       "מידע לא ברור",
  irrelevant:    "תשובה לא רלוונטית",
  outdated:      "מידע לא עדכני",
  missing_topic: "נושא לא מכוסה",
  other:         "אחר",
};

// Fetches feedback filtered by rating and an ISO date range.
// rating: "positive" | "negative" | undefined (all). from/to: ISO strings.
export async function fetchFeedback({ rating, from, to } = {}) {
  let query = db.collection("feedback");
  if (from) query = query.where("createdAt", ">=", from);
  if (to) query = query.where("createdAt", "<=", to);

  const snap = await query.get();
  let items = snap.docs.map((d) => d.data());
  if (rating === "positive" || rating === "negative") {
    items = items.filter((f) => f.rating === rating);
  }
  return items;
}

export function computeStats(items) {
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
    .map(([reason, count]) => `<li>${REASON_LABELS[reason] ?? reason}: ${count}</li>`)
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

export function feedbackToCsv(rows) {
  const header = ["דירוג", "סיבות", "הערה", "תאריך"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")];
  for (const r of rows) {
    const rating = r.rating === "positive" ? "חיובי" : "שלילי";
    const reasons = (r.reasons || []).map((x) => REASON_LABELS[x] ?? x).join("; ");
    const date = r.createdAt ? new Date(r.createdAt).toLocaleString("he-IL") : "";
    lines.push([rating, reasons, r.comment, date].map(esc).join(","));
  }
  // BOM so Excel reads the Hebrew as UTF-8.
  return "﻿" + lines.join("\r\n");
}

// Encodes a CSV string as a Brevo attachment object.
export function csvAttachment(csv, name) {
  return { content: Buffer.from(csv, "utf-8").toString("base64"), name };
}
