import { db } from "../../server.js";
import { callLLMJson } from "../../services/llm.js";

/* ================= utils ================= */

const normalize = (s = "") =>
  String(s)
    .replace(/["׳״'`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

/* ================= date helpers ================= */

function parseLabDate(dateStr) {
  if (!dateStr) return null;

  const clean = String(dateStr)
    .replace(/^[א-ת]'\s*/, "")
    .replace(/^[א-ת]\s*/, "")
    .trim();

  const m = clean.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let [, d, mth, y] = m;
    if (y.length === 2) y = "20" + y;
    return new Date(`${y}-${mth.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }

  const iso = new Date(clean);
  return isNaN(iso) ? null : iso;
}

function inRange(d, start, end) {
  return d && d >= start && d <= end;
}

function isTimeMatch(labDate, time) {
  const d = parseLabDate(labDate);
  if (!d) return false;

  const now = new Date();

  if (time === "today") return d.toDateString() === now.toDateString();

  if (time === "tomorrow") {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return d.toDateString() === t.toDateString();
  }

  if (time === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return inRange(d, start, end);
  }

  if (time === "next_week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return inRange(d, start, end);
  }

  return true; // time = all
}

/* ================= Gemini ================= */

async function classifyWithGemini(question) {
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

/* ================= Firestore ================= */

async function getLatestYearId() {
  const snap = await db.collection("lab_schedule").orderBy("updatedAt", "desc").limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function getAllLabs(yearId) {
  const semSnap = await db.collection("lab_schedule").doc(yearId).collection("semesters").get();

  const labs = [];

  for (const sem of semSnap.docs) {
    const semData = sem.data() || {};
    const semesterNum = Number(semData.semester ?? sem.id); // fallback to the document ID as semester number
    const courses = semData.courses || {};

    for (const course of Object.values(courses)) {
      for (const lab of course.labs || []) {
        labs.push({
          semester: semesterNum,
          courseName: course.courseName,
          ...lab,
        });
      }
    }
  }

  return labs;
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

    const parsed = await classifyWithGemini(question);
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

    let labs = await getAllLabs(yearId);

    /* ===== filters ===== */
        if (parsed.semester != null) {
      labs = labs.filter((l) => Number(l.semester) === Number(parsed.semester));
    }


    if (parsed.course) {
      const key = normalize(parsed.course);
      labs = labs.filter((l) => normalize(l.courseName).includes(key));
    }

    if (parsed.session != null) {
      labs = labs.filter((l) => Number(l.session) === Number(parsed.session));
    }

    if (parsed.group) {
      labs = labs.filter((l) => String(l.group) === String(parsed.group));
    }

    if (parsed.lecturer) {
      const key = normalize(parsed.lecturer);
      labs = labs.filter((l) => {
        const staff = Array.isArray(l.staff) ? l.staff.join(" ") : l.staff || "";
        return normalize(staff).includes(key);
      });
    }

    if (parsed.day) {
      labs = labs.filter((l) => l.day === parsed.day);
    }

    if (parsed.date) {
      const target = parseLabDate(parsed.date);
      labs = labs.filter((l) => {
        const d = parseLabDate(l.date);
        return d && target && d.toDateString() === target.toDateString();
      });
    }

    if (parsed.time && parsed.time !== "all") {
      labs = labs.filter((l) => isTimeMatch(l.date, parsed.time));
    }

    /* ===== next lab ===== */

    if (parsed.intent === "next_lab") {
      const now = new Date();
      const future = labs
        .map((l) => ({ ...l, _d: parseLabDate(l.date) }))
        .filter((l) => l._d && l._d >= now)
        .sort((a, b) => a._d - b._d);

      if (!future.length) {
        return res.json({
          html: `<div class="text-sm text-gray-800 dark:text-slate-100">ℹ️ לא נמצאה מעבדה עתידית.</div>`,
        });
      }

      labs = [future[0]];
    }

    if (!labs.length) {
      return res.json({
        html: `<div class="text-sm text-gray-800 dark:text-slate-100">ℹ️ לא נמצאו מעבדות מתאימות.</div>`,
      });
    }

    /* ===== HTML (Dark Mode) ===== */

    const html = labs
      .map((l) => {
        const staff = Array.isArray(l.staff) ? l.staff.join(", ") : l.staff || "-";

        return `
          <div class="mb-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm
                      text-gray-800
                      dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <div class="font-bold text-blue-700 dark:text-sky-300">
              📘 ${l.courseName || "-"} <span class="opacity-80">(סמסטר ${l.semester ?? "-"})</span>
            </div>

            <div class="mt-1">
              🧪 <b>מעבדה:</b> ${l.session ?? "-"}
            </div>

            <div class="mt-1">
              📅 <b>מועד:</b>
              ${l.day || ""} ${l.date || "-"}
              <span class="mx-1 opacity-60">|</span>
              ⏰ ${l.time || "-"}
            </div>

            <div class="mt-1">
              👥 <b>קבוצה:</b> ${l.group || "-"}
            </div>

            <div class="mt-1">
              👩‍🏫 <b>מרצה:</b> ${staff}
            </div>
          </div>
        `;
      })
      .join("");

    return res.json({ html: `<div class="text-sm">${html}</div>` });
  } catch (err) {
    console.error("ASK LABS ERROR:", err);
    return res.status(500).json({
      html: `<div class="text-sm text-gray-800 dark:text-slate-100">⚠️ שגיאה בעיבוד שאלה</div>`,
    });
  }
}
