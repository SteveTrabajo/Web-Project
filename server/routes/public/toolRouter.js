import { db } from "../../server.js";
import { callLLMTools } from "../../services/llm.js";

/*
 * toolRouter.js - PROTOTYPE
 * -------------------------
 * A minimal tool-calling router that replaces keyword matching with an LLM
 * that picks a function from natural-language descriptions. Runs beside the
 * existing keyword pipeline (see /api/ask-tools in ask.js) so it can be tested
 * on real data without touching production routing.
 *
 * Two tools are wired up (forward + reverse prerequisites) so the LLM must
 * disambiguate "prereqs of X" from "courses requiring X" - the distinction the
 * keyword pipeline kept getting backwards. Promotion would (a) extract the
 * course-data helpers below into a shared module imported by both this file and
 * ask.js, and (b) register the remaining builders (labs, registration) as tools.
 */

/* ---------- prototype-local course-data helpers ---------- */

function normalizeHebrew(s = "") {
  return String(s)
    .replace(/["׳״'`]/g, "")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

const _coursesCache = new Map();
const TTL_MS = 5 * 60 * 1000;

async function getCourses(yearbookId) {
  const now = Date.now();
  const cached = _coursesCache.get(yearbookId);
  if (cached && now - cached.ts < TTL_MS) return cached.courses;

  const semSnap = await db.collection("yearbooks").doc(yearbookId).collection("requiredCourses").get();
  const perSem = await Promise.all(semSnap.docs.map((s) => s.ref.collection("courses").get()));

  const courses = [];
  perSem.forEach((snap) => {
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const courseCode = String(d.courseCode || doc.id);
      const courseName = String(d.courseName || "");
      courses.push({ courseCode, courseName, nameNorm: normalizeHebrew(courseName), codeNorm: courseCode.replace(/\s+/g, "") });
    });
  });

  _coursesCache.set(yearbookId, { ts: now, courses });
  return courses;
}

function matchCourse(raw, courses) {
  const n = normalizeHebrew(raw);
  if (!n) return null;
  if (/^\d{5,6}$/.test(n)) return courses.find((c) => c.codeNorm === n) || null;
  return (
    courses.find((c) => c.nameNorm === n) ||
    courses.find((c) => c.nameNorm.includes(n) || n.includes(c.nameNorm)) ||
    null
  );
}

// One collectionGroup scan builds both directions, cached per yearbook.
// forward: course -> its prerequisites; reverse: course -> courses that require it.
const _relIndexCache = new Map();

async function getRelationIndex(yearbookId) {
  const now = Date.now();
  const cached = _relIndexCache.get(yearbookId);
  if (cached && now - cached.ts < TTL_MS) return cached.index;

  const snap = await db.collectionGroup("relations").get();
  const forward = new Map();
  const reverse = new Map();
  for (const doc of snap.docs) {
    if (!doc.ref.path.startsWith(`yearbooks/${yearbookId}/`)) continue;
    const dependentCode = doc.ref.parent.parent?.id;
    const prereqCode = doc.id;
    if (!dependentCode) continue;
    const type = doc.data()?.type || null;
    if (!forward.has(dependentCode)) forward.set(dependentCode, []);
    forward.get(dependentCode).push({ code: prereqCode, type });
    if (!reverse.has(prereqCode)) reverse.set(prereqCode, []);
    reverse.get(prereqCode).push({ code: dependentCode, type });
  }

  const index = { forward, reverse };
  _relIndexCache.set(yearbookId, { ts: now, index });
  return index;
}

/* ---------- tool executors ---------- */

const nameOf = (courses, code) => courses.find((c) => c.courseCode === code)?.courseName || code;

async function runGetCoursesRequiring({ course }, { yearbookId }) {
  const courses = await getCourses(yearbookId);
  const target = matchCourse(course, courses);
  if (!target) {
    return `<div class="text-sm">ℹ️ לא זיהיתי את הקורס "${course}".</div>`;
  }

  const { reverse } = await getRelationIndex(yearbookId);
  const dependents = [...new Set((reverse.get(target.courseCode) || []).filter((r) => r.type === "PREREQUISITE").map((r) => r.code))];

  if (!dependents.length) {
    return `<div class="text-sm">ℹ️ <b>${target.courseName}</b> לא מופיע כדרישת קדם לקורסים אחרים בשנתון.</div>`;
  }

  const names = dependents.map((code) => nameOf(courses, code));
  return `
    <div class="text-sm leading-6">
      📘 <b class="bot-title">קורסים הדורשים את ${target.courseName} כקדם</b><br/><br/>
      ${names.map((n) => `• ${n}`).join("<br/>")}
    </div>`;
}

// Direct prerequisites only. Promotion would call ask.js's recursive builder.
async function runGetPrerequisites({ course }, { yearbookId }) {
  const courses = await getCourses(yearbookId);
  const target = matchCourse(course, courses);
  if (!target) {
    return `<div class="text-sm">ℹ️ לא זיהיתי את הקורס "${course}".</div>`;
  }

  const { forward } = await getRelationIndex(yearbookId);
  const prereqs = [...new Set((forward.get(target.courseCode) || []).filter((r) => r.type === "PREREQUISITE").map((r) => r.code))];

  if (!prereqs.length) {
    return `<div class="text-sm">ℹ️ ל־<b>${target.courseName}</b> אין קורסי קדם ישירים בשנתון.</div>`;
  }

  const names = prereqs.map((code) => nameOf(courses, code));
  return `
    <div class="text-sm leading-6">
      📘 <b class="bot-title">קורסי קדם ל־${target.courseName}</b><br/><br/>
      ${names.map((n) => `• ${n}`).join("<br/>")}
    </div>`;
}

/* ---------- tool registry ---------- */

const COURSE_ARG = {
  type: "object",
  properties: {
    course: { type: "string", description: "שם הקורס או קוד הקורס, למשל 'ביוכימיה' או '41345'." },
  },
  required: ["course"],
};

const TOOLS = [
  {
    schema: {
      type: "function",
      function: {
        name: "get_prerequisites",
        description:
          "מחזיר את קורסי הקדם של הקורס הנתון - מה צריך ללמוד לפניו. " +
          "השתמש כאשר המשתמש שואל למשל: 'מה קורסי הקדם של X', 'מה צריך לפני X', 'מה הדרישות לקורס X'.",
        parameters: COURSE_ARG,
      },
    },
    run: runGetPrerequisites,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "get_courses_requiring",
        description:
          "מחזיר את רשימת הקורסים שהקורס הנתון מהווה עבורם דרישת קדם (הכיוון ההפוך של קורסי קדם). " +
          "השתמש כאשר המשתמש שואל למשל: 'לאילו קורסים ביוכימיה היא דרישת קדם', 'אילו קורסים דורשים את X', " +
          "'מה אפשר ללמוד אחרי X'. אל תשתמש כאשר שואלים מה קורסי הקדם של X עצמו.",
        parameters: COURSE_ARG,
      },
    },
    run: runGetCoursesRequiring,
  },
];

/* ---------- router ---------- */

export async function routeWithTools(question, yearbookId) {
  const msg = await callLLMTools(
    [
      {
        role: "system",
        content:
          "אתה עוזר אקדמי למחלקה לביוטכנולוגיה במכללת בראודה. " +
          "בחר בכלי המתאים ביותר לשאלת המשתמש. אם אף כלי אינו מתאים, אל תזמן כלי - " +
          "ענה במשפט קצר שאין לך מידע על כך.",
      },
      { role: "user", content: question },
    ],
    TOOLS.map((t) => t.schema)
  );

  if (!msg) {
    return { type: "error", html: `<div class="text-sm">⚠️ שגיאה בעיבוד השאלה.</div>` };
  }

  const call = msg.tool_calls?.[0];
  if (!call) {
    // No tool matched. This is the "unsupported topic" case - for free, with no keyword list.
    return {
      type: "no_tool",
      html: `<div class="text-sm">ℹ️ ${msg.content || "אין לי מידע על כך כרגע."}</div>`,
    };
  }

  const tool = TOOLS.find((t) => t.schema.function.name === call.function.name);
  let args = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    // leave args empty; executor handles the missing field
  }

  const html = await tool.run(args, { yearbookId });
  return { type: "tool", tool: call.function.name, args, html };
}
