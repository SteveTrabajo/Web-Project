import { db } from "../server.js";

// Lab-schedule data access, filtering, and rendering (askLabs.js + toolRouter.js).

const normalize = (s = "") =>
  String(s)
    .replace(/["׳״'`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

/* ================= date / day helpers ================= */

export function parseLabDate(dateStr) {
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

/* ================= Firestore ================= */

// Most recently uploaded lab year. Note: intentionally ignores a client's
// yearbook - lab schedules are keyed separately and only the latest is served.
export async function getLatestYearId() {
  const snap = await db.collection("lab_schedule").orderBy("updatedAt", "desc").limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function getAllLabs(yearId) {
  const semSnap = await db.collection("lab_schedule").doc(yearId).collection("semesters").get();

  const labs = [];
  for (const sem of semSnap.docs) {
    const semData = sem.data() || {};
    const semesterNum = Number(semData.semester ?? sem.id);
    const courses = semData.courses || {};

    for (const course of Object.values(courses)) {
      for (const lab of course.labs || []) {
        labs.push({ semester: semesterNum, courseName: course.courseName, ...lab });
      }
    }
  }
  return labs;
}

/* ================= filtering / next-lab / render ================= */

// criteria: { course, semester, session, lecturer, group, day, date, time }
export function filterLabs(labs, criteria = {}) {
  let out = labs;

  if (criteria.semester != null) out = out.filter((l) => Number(l.semester) === Number(criteria.semester));

  if (criteria.course) {
    const key = normalize(criteria.course);
    out = out.filter((l) => normalize(l.courseName).includes(key));
  }

  if (criteria.session != null) out = out.filter((l) => Number(l.session) === Number(criteria.session));

  if (criteria.group) out = out.filter((l) => String(l.group) === String(criteria.group));

  if (criteria.lecturer) {
    const key = normalize(criteria.lecturer);
    out = out.filter((l) => {
      const staff = Array.isArray(l.staff) ? l.staff.join(" ") : l.staff || "";
      return normalize(staff).includes(key);
    });
  }

  if (criteria.day) out = out.filter((l) => dayMatches(l.day, criteria.day));

  if (criteria.date) {
    const target = parseLabDate(criteria.date);
    out = out.filter((l) => {
      const range = labDateRange(l);
      return range && target && target >= range.start && target <= range.end;
    });
  }

  if (criteria.time && criteria.time !== "all") out = out.filter((l) => isTimeMatch(l, criteria.time));

  return out;
}

// Earliest lab whose end is still in the future, or null.
export function findNextLab(labs) {
  const now = new Date();
  return (
    labs
      .filter((l) => {
        const r = labDateRange(l);
        return r && r.end >= now;
      })
      .sort((a, b) => labDateRange(a).start - labDateRange(b).start)[0] || null
  );
}

export function renderLabsHtml(labs) {
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

  return `<div class="text-sm">${html}</div>`;
}
