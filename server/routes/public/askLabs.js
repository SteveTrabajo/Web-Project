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

  const isoM = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) {
    return new Date(+isoM[1], +isoM[2] - 1, +isoM[3]);
  }

  const m = clean.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let [, d, mth, y] = m;
    if (y.length === 2) y = "20" + y;
    return new Date(`${y}-${mth.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }

  const iso = new Date(clean);
  return isNaN(iso) ? null : iso;
}

// A lab occupies [start, end]; single-day labs have end = start at 23:59:59
function labDateRange(lab) {
  const start = parseLabDate(lab.date);
  if (!start) return null;

  const end = (lab.dateEnd && parseLabDate(lab.dateEnd)) || new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function rangesOverlap(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

function dayWindow(base, offsetDays) {
  const start = new Date(base);
  start.setDate(start.getDate() + offsetDays);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function weekWindow(base, offsetWeeks) {
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay() + offsetWeeks * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isTimeMatch(lab, time) {
  const range = labDateRange(lab);
  if (!range) return false;

  const now = new Date();

  if (time === "today") return rangesOverlap(range, dayWindow(now, 0));
  if (time === "tomorrow") return rangesOverlap(range, dayWindow(now, 1));
  if (time === "week") return rangesOverlap(range, weekWindow(now, 0));
  if (time === "next_week") return rangesOverlap(range, weekWindow(now, 1));

  return true; // time = all
}

const DAY_LETTERS = "אבגדהו";

function dayMatches(labDay, letter) {
  const stored = String(labDay || "").trim();
  if (!stored || !letter) return false;

  // Day range like "א'- ג'": match if the letter falls inside the range
  const m = stored.match(/^([א-ת])'?\s*[-–]\s*([א-ת])'?$/);
  if (m) {
    const idx = DAY_LETTERS.indexOf(letter);
    const from = DAY_LETTERS.indexOf(m[1]);
    const to = DAY_LETTERS.indexOf(m[2]);
    if (idx >= 0 && from >= 0 && to >= 0) return idx >= from && idx <= to;
  }

  // Handles stored "ב'" (with geresh) vs queried "ב"
  return stored.includes(letter);
}

function formatLabDateHtml(lab) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const s = String(lab.date || "").match(iso);
  if (!s) return lab.date || "-";

  const e = String(lab.dateEnd || "").match(iso);
  if (!e) return `${s[3]}/${s[2]}/${s[1]}`;

  if (s[1] === e[1] && s[2] === e[2]) return `${s[3]}-${e[3]}/${s[2]}/${s[1]}`;
  return `${s[3]}/${s[2]}-${e[3]}/${e[2]}/${e[1]}`;
}

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
      labs = labs.filter((l) => dayMatches(l.day, parsed.day));
    }

    if (parsed.date) {
      const target = parseLabDate(parsed.date);
      labs = labs.filter((l) => {
        const range = labDateRange(l);
        return range && target && target >= range.start && target <= range.end;
      });
    }

    if (parsed.time && parsed.time !== "all") {
      labs = labs.filter((l) => isTimeMatch(l, parsed.time));
    }

    /* ===== next lab ===== */

    if (parsed.intent === "next_lab") {
      const now = new Date();
      const future = labs
        .map((l) => ({ ...l, _r: labDateRange(l) }))
        .filter((l) => l._r && l._r.end >= now)
        .sort((a, b) => a._r.start - b._r.start);

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
            <div class="bot-title font-bold text-blue-700 dark:text-sky-300">
              📘 ${l.courseName || "-"} <span class="opacity-80">(סמסטר ${l.semester ?? "-"})</span>
            </div>

            <div class="mt-1">
              🧪 <b>מעבדה:</b> ${l.session ?? "-"}
            </div>

            <div class="mt-1">
              📅 <b>מועד:</b>
              ${l.day || ""} ${formatLabDateHtml(l)}
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
