import { callLLMJson } from "../../services/llm.js";
import {
  getLatestYearId,
  getAllLabs,
  filterLabs,
  findNextLab,
  renderLabs,
} from "../../services/labsData.js";

/* ================= LLM ================= */

async function classifyWithLLM(question) {
  const prompt = `
החזירי JSON בלבד. בלי טקסט נוסף.

מבנה:
{
  "intent": "lab_query" | "next_lab",
  "course": string | null,
  "semester": number | null,
  "session": number | null,
  "lecturer": string | null,
  "group": string | null,
  "time": "today" | "tomorrow" | "week" | "next_week" | "all",
  "date": string | null,
  "day": "א" | "ב" | "ג" | "ד" | "ה" | "ו" | null
}

חוקים:
- "מתי" / "איזה" → lab_query
- "המעבדה הבאה / הקרובה" → next_lab
- "מעבדה 2" → session = 2
- "סמסטר 2" / "בסמסטר 2" / "לסמסטר 2" → semester = 2
- שם קורס (כמו "ביוכימיה") → course
- שם מרצה (כמו "מרינה טל") → lecturer
- "היום / מחר / השבוע / שבוע הבא" → time
- "ביום חמישי" → day="ה"
- אל תחזירי null אם המידע מופיע בשאלה

שאלה:
"${question}"
`;

  return callLLMJson(prompt);
}

/* ================= MAIN ================= */

export default async function askLabs(req, res) {
  try {
    const { question } = req.body || {};
    if (!question) {
      return res.json({
        html: `<div class="text-sm text-gray-800 dark:text-slate-100">❌ חסרה שאלה</div>`,
      });
    }

    const parsed = await classifyWithLLM(question);
    if (!parsed) {
      return res.json({
        html: `<div class="text-sm text-gray-800 dark:text-slate-100">❌ לא הצלחתי להבין את השאלה</div>`,
      });
    }

    const yearId = await getLatestYearId();
    if (!yearId) {
      return res.json({
        html: `<div class="text-sm text-gray-800 dark:text-slate-100">❌ לא נמצאה שנת לימודים פעילה</div>`,
      });
    }

    let labs = filterLabs(await getAllLabs(yearId), parsed);

    if (parsed.intent === "next_lab") {
      const next = findNextLab(labs);
      if (!next) {
        return res.json({
          html: `<div class="text-sm text-gray-800 dark:text-slate-100">ℹ️ לא נמצאה מעבדה עתידית.</div>`,
        });
      }
      labs = [next];
    }

    if (!labs.length) {
      return res.json({
        html: `<div class="text-sm text-gray-800 dark:text-slate-100">ℹ️ לא נמצאו מעבדות מתאימות.</div>`,
      });
    }

    return res.json({ html: renderLabs(labs, parsed) });
  } catch (err) {
    console.error("ASK LABS ERROR:", err);
    return res.status(500).json({
      html: `<div class="text-sm text-gray-800 dark:text-slate-100">⚠️ שגיאה בעיבוד שאלה</div>`,
    });
  }
}
