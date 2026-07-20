import { callLLMTools } from "../../services/llm.js";
import { getAllCoursesCached, matchCourse, getRelationIndex, buildCourseInfoHtml, findCoursesInText } from "../../services/courseData.js";
import { ragCuratedAnswer } from "../../services/curatedRag.js";
import { getLatestYearId, getAllLabs, filterLabs, findNextLab, renderLabs } from "../../services/labsData.js";
import { answerRegistration, findContactsByQuery } from "./registration.service.js";

/*
 * Tool-calling router: an LLM picks a tool from natural-language descriptions
 * instead of keyword matching. Data/RAG come from the shared services modules.
 * Adding a capability = one executor + one schema entry in TOOLS. No keyword lists.
 */

const nameOf = (courses, code) => courses.find((c) => c.courseCode === code)?.courseName || code;

// Honest admission when the bot has no data, instead of a guessed answer.
const NO_ANSWER_HTML =
  `<div class="text-sm">ℹ️ אין לי תשובה לשאלה הזו כרגע. ` +
  `מומלץ לפנות למזכירות המחלקה או ליועץ/ת האקדמי/ת לקבלת מידע מדויק.</div>`;

// Direct prerequisites only (not the recursive chain).
async function runGetPrerequisites({ course }, { yearbookId }) {
  const courses = await getAllCoursesCached(yearbookId);
  const target = matchCourse(course, courses);
  if (!target) return `<div class="text-sm">ℹ️ לא זיהיתי את הקורס "${course}".</div>`;

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

// General course attributes: credits (נ"ז), weekly hours, semester.
async function runGetCourseInfo({ course }, { yearbookId }) {
  const courses = await getAllCoursesCached(yearbookId);
  const target = matchCourse(course, courses);
  if (!target) return `<div class="text-sm">ℹ️ לא זיהיתי את הקורס "${course}".</div>`;
  return buildCourseInfoHtml(target);
}

async function runGetCoursesRequiring({ course }, { yearbookId }) {
  const courses = await getAllCoursesCached(yearbookId);
  const target = matchCourse(course, courses);
  if (!target) return `<div class="text-sm">ℹ️ לא זיהיתי את הקורס "${course}".</div>`;

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

function runEmotionalSupport() {
  return `
    <div dir="rtl" class="text-sm leading-6 text-right">
      💙 זה בסדר להרגיש ככה, את/ה לא לבד.<br/>
      הרבה סטודנטים חווים עומס ובלבול במהלך הלימודים.<br/><br/>

      אם את/ה מרגיש/ה צורך בעזרה נוספת, אפשר וכדאי לפנות לדיקנט הסטודנטים.<br/><br/>

      <div class="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-right
                  dark:bg-slate-950 dark:border-slate-700">
        <div class="font-semibold mb-1">📌 פרטי הדיקנט</div>
        <div class="space-y-1 text-sm">
          <div>📞 טלפון: <span dir="ltr">04-9901906</span></div>
          <div>
            ✉️ דוא״ל:
            <a class="underline text-blue-700 dark:text-sky-300" href="mailto:dean@braude.ac.il">
              dean@braude.ac.il
            </a>
          </div>
        </div>
      </div>

      <div class="mt-3">
        אפשר גם לפנות ליועץ/ת האקדמי/ת שלך.<br/>
        ניתן למצוא יועץ/ת דרך התפריט למטה 👇
      </div>
    </div>`;
}

async function runSearchKnowledgeBase({ query }, { yearbookId }) {
  const hit = await ragCuratedAnswer(query, yearbookId);
  // A miss is an info gap, not an answer: signal it so it counts as unanswered
  // and reaches the admin unanswered-questions tab.
  if (!hit) return { html: NO_ANSWER_HTML, answered: false, source: "kb_miss" };
  return hit.answerHtml;
}

// Direct relations only (does not catch an indirect prereq).
async function runGetCourseRelations({ course_a, course_b }, { yearbookId }) {
  const courses = await getAllCoursesCached(yearbookId);
  const A = matchCourse(course_a, courses);
  const B = matchCourse(course_b, courses);
  if (!A || !B) {
    return `<div class="text-sm">ℹ️ לא זיהיתי את הקורס "${!A ? course_a : course_b}".</div>`;
  }

  const { forward } = await getRelationIndex(yearbookId);
  const relsA = forward.get(A.courseCode) || [];
  const relsB = forward.get(B.courseCode) || [];
  const bIsPrereqOfA = relsA.some((r) => r.code === B.courseCode && r.type === "PREREQUISITE");
  const aIsPrereqOfB = relsB.some((r) => r.code === A.courseCode && r.type === "PREREQUISITE");
  const coreq =
    relsA.some((r) => r.code === B.courseCode && r.type === "COREQUISITE") ||
    relsB.some((r) => r.code === A.courseCode && r.type === "COREQUISITE");

  if (bIsPrereqOfA) {
    return `<div class="text-sm leading-6">⛔ לא ניתן ללמוד יחד.<br/>📌 קודם צריך לסיים <b>${B.courseName}</b>, ואז לקחת <b>${A.courseName}</b>.</div>`;
  }
  if (aIsPrereqOfB) {
    return `<div class="text-sm leading-6">⛔ לא ניתן ללמוד יחד.<br/>📌 קודם צריך לסיים <b>${A.courseName}</b>, ואז לקחת <b>${B.courseName}</b>.</div>`;
  }
  if (coreq) {
    return `<div class="text-sm leading-6">✅ אפשר ללמוד במקביל 🙂<br/>• ${A.courseName} ו־${B.courseName}</div>`;
  }
  return `<div class="text-sm leading-6">ℹ️ לא נראה שיש דרישות קדם ביניהם - אפשר ללמוד יחד 😊</div>`;
}

async function runGetRegistrationInfo(args) {
  return answerRegistration({ semester: args.semester ?? null, aspect: args.aspect || "general", forms: [] });
}

async function runFindContact({ query }) {
  const hits = await findContactsByQuery(query || "");
  if (!hits.length) return `<div class="text-sm">ℹ️ לא מצאתי איש קשר מתאים לשאלה.</div>`;
  const rows = hits
    .map((c) => {
      const role = c.role ? ` – ${c.role}` : "";
      const email = c.email ? `<br/><a href="mailto:${c.email}">${c.email}</a>` : "";
      const phone = c.phone ? `<br/>📞 <span dir="ltr">${c.phone}</span>` : "";
      return `<div class="mb-2"><b>${c.name}</b>${role}${email}${phone}</div>`;
    })
    .join("");
  return `<div dir="rtl" class="text-sm leading-6 text-right">${rows}</div>`;
}

async function runGetRequiredCourses({ semester }, { yearbookId }) {
  const courses = await getAllCoursesCached(yearbookId);
  const inSem = courses.filter((c) => c.semesterKey === `semester_${semester}`);
  if (!inSem.length) return `<div class="text-sm">ℹ️ לא נמצאו קורסי חובה לסמסטר ${semester}.</div>`;
  return `
    <div class="text-sm leading-6">
      📚 <b class="bot-title">קורסי חובה - סמסטר ${semester}</b><br/><br/>
      ${inSem.map((c) => `• ${c.courseName} (${c.courseCode})`).join("<br/>")}
    </div>`;
}

async function runGetLabSchedule(args) {
  const yearId = await getLatestYearId();
  if (!yearId) return `<div class="text-sm">ℹ️ לא נמצאה שנת לימודים פעילה.</div>`;

  let labs = filterLabs(await getAllLabs(yearId), args);

  if (args.intent === "next_lab") {
    const next = findNextLab(labs);
    if (!next) return `<div class="text-sm">ℹ️ לא נמצאה מעבדה עתידית.</div>`;
    labs = [next];
  }

  if (!labs.length) return `<div class="text-sm">ℹ️ לא נמצאו מעבדות מתאימות.</div>`;
  return renderLabs(labs, args);
}

/* ---------- tool registry ---------- */

const COURSE_ARG = {
  type: "object",
  properties: {
    course: {
      type: "string",
      description:
        "שם הקורס או קוד הקורס בדיוק כפי שהוזכר בשאלת המשתמש (קוד = 5-6 ספרות). " +
        "אל תמציא/י שם קורס ואל תעתיק/י דוגמאות מתיאורי הכלים - העבר/י רק את הקורס שבשאלה.",
    },
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
        name: "get_course_info",
        description:
          "מחזיר מידע כללי על קורס יחיד: מספר/קוד הקורס, שם, נקודות זכות (נ\"ז), שעות שבועיות (הרצאה/תרגול/מעבדה) ובאיזה סמסטר. " +
          "השתמש כאשר המשתמש שואל על מאפייני קורס או על מספר/קוד הקורס - למשל 'מה מספר הקורס של X', 'מה הקוד של X', " +
          "'כמה נקז נותן X', 'כמה שעות שבועיות ל-X', 'באיזה סמסטר לומדים את X'. " +
          "השתמש גם כאשר המשתמש מזכיר שם של קורס בלבד ללא שאלה מפורשת (ברירת מחדל לכל אזכור של קורס יחיד). " +
          "אל תשתמש עבור קורסי קדם או קשר בין קורסים.",
        parameters: COURSE_ARG,
      },
    },
    run: runGetCourseInfo,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "get_courses_requiring",
        description:
          "מחזיר את רשימת הקורסים שהקורס הנתון מהווה עבורם דרישת קדם (הכיוון ההפוך של קורסי קדם). " +
          "השתמש כאשר המשתמש שואל למשל: 'לאילו קורסים X היא דרישת קדם', 'אילו קורסים דורשים את X', " +
          "'מה אפשר ללמוד אחרי X'. אל תשתמש כאשר שואלים מה קורסי הקדם של X עצמו.",
        parameters: COURSE_ARG,
      },
    },
    run: runGetCoursesRequiring,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "get_course_relations",
        description:
          "בודק את היחס בין שני קורסים - האם אפשר ללמוד אותם יחד/במקביל, או שאחד מהם דרישת קדם לשני. " +
          "השתמש רק כאשר המשתמש מזכיר שני קורסים ושואל אם אפשר לקחת אותם יחד/במקביל או מה הסדר ביניהם. " +
          "אל תשתמש לשאלה על קורס יחיד.",
        parameters: {
          type: "object",
          properties: {
            course_a: { type: "string", description: "הקורס הראשון (שם או קוד)." },
            course_b: { type: "string", description: "הקורס השני (שם או קוד)." },
          },
          required: ["course_a", "course_b"],
        },
      },
    },
    run: runGetCourseRelations,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "find_contact",
        description:
          "מחזיר פרטי קשר (שם, תפקיד, מייל, טלפון) של איש/אשת סגל ספציפי/ת - למשל מזכירת המחלקה, " +
          "ראש המחלקה, רכז/ת. השתמש כאשר המשתמש מבקש מי אחראי על תפקיד מסוים או את פרטי הקשר שלו/ה.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "התפקיד או השם המבוקש, למשל 'מזכירת המחלקה' או 'ראש המחלקה'." },
          },
          required: ["query"],
        },
      },
    },
    run: runFindContact,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "get_required_courses",
        description:
          "מחזיר את רשימת קורסי החובה בסמסטר נתון. השתמש כאשר המשתמש שואל אילו קורסים/קורסי חובה יש בסמסטר מסוים.",
        parameters: {
          type: "object",
          properties: {
            semester: { type: "number", description: "מספר הסמסטר." },
          },
          required: ["semester"],
        },
      },
    },
    run: runGetRequiredCourses,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "get_registration_info",
        description:
          "מידע על תהליך הרישום לקורסים: חלון/מועד הרישום, יועצים אקדמיים, סטודנט/ית מלווה, נקודות זכות לתואר, " +
          "קישורי הדרכה, תנאי סטאז'/התמחות, פטורים/חריגים, אנשי קשר לרישום, ומי איש הקשר האחראי על המעבדות. " +
          "השתמש לשאלות על תהליך הרישום ומועדיו. " +
          "אל תשתמש עבור מעבדות עצמן - רשימת מעבדות, אילו מעבדות יש בסמסטר, לוח או מועדי מעבדות (לכך יש get_lab_schedule); " +
          "aspect=labs הוא אך ורק לשאלת 'מי אחראי המעבדות', לא לרשימת המעבדות.",
        parameters: {
          type: "object",
          properties: {
            semester: { type: "number", description: "מספר סמסטר, אם צוין." },
            aspect: {
              type: "string",
              enum: ["window", "advisors", "mentors", "credits", "links", "internship", "exemptions", "contacts", "labs", "general"],
              description:
                "היבט הרישום: window=חלון/מועד רישום, advisors=יועצים אקדמיים, mentors=סטודנט מלווה, " +
                "credits=נקודות זכות, links=קישורי הדרכה, internship=סטאז'/התמחות, exemptions=פטורים/חריגים, " +
                "contacts=אנשי קשר לרישום, labs=מי איש הקשר האחראי על המעבדות (לא רשימת המעבדות), general=כללי.",
            },
          },
          required: ["aspect"],
        },
      },
    },
    run: runGetRegistrationInfo,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "get_lab_schedule",
        description:
          "מחזיר מעבדות (מעבדה = lab) ומועדיהן - תאריך, יום, שעה, קבוצה ומרצה. " +
          "השתמש לכל שאלה על מעבדות עצמן: 'מתי המעבדה של X', 'המעבדה הבאה', 'אילו מעבדות יש ביום ה', " +
          "וגם 'אילו מעבדות/רשימת המעבדות/מה המעבדות בסמסטר X' (עם semester). " +
          "אך ורק למעבדות - לא למועדי מבחנים/בחינות (מועד א'/ב'/ג'), ולא לאיש הקשר האחראי על המעבדות (לכך יש get_registration_info). " +
          "כל הפרמטרים אופציונליים - מלא רק את מה שמופיע בשאלה.",
        parameters: {
          type: "object",
          properties: {
            course: { type: "string", description: "שם הקורס, אם צוין." },
            semester: { type: "number", description: "מספר סמסטר, אם צוין." },
            session: { type: "number", description: "מספר המעבדה/מפגש, אם צוין (למשל 'מעבדה 2' -> 2)." },
            lecturer: { type: "string", description: "שם המרצה, אם צוין." },
            group: { type: "string", description: "קבוצת מעבדה, אם צוינה." },
            day: { type: "string", enum: ["א", "ב", "ג", "ד", "ה", "ו"], description: "יום בשבוע כאות בודדת, אם צוין." },
            date: { type: "string", description: "תאריך ספציפי, אם צוין." },
            time: { type: "string", enum: ["today", "tomorrow", "week", "next_week", "all"], description: "חלון זמן יחסי." },
            intent: { type: "string", enum: ["lab_query", "next_lab"], description: "next_lab עבור 'המעבדה הבאה/הקרובה', אחרת lab_query." },
          },
          required: [],
        },
      },
    },
    run: runGetLabSchedule,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "emotional_support",
        description:
          "השתמש אך ורק כאשר יש ביטוי מפורש של מצוקה רגשית אישית - לחץ, חרדה, תסכול, שחיקה " +
          "(למשל 'אני לא מסתדר', 'קשה לי מאוד', 'אני בלחץ מהלימודים', 'מרגיש שאני נכשל'). " +
          "מספק תמיכה ופרטי דיקנט הסטודנטים. אל תשתמש עבור שאלות מידע, שאלות מעורפלות " +
          "(כמו 'מה הזכאות שלי'), ברכות, או טקסט שאינו מביע מצוקה.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    run: runEmotionalSupport,
  },
  {
    schema: {
      type: "function",
      function: {
        name: "search_knowledge_base",
        description:
          "כלי ברירת המחדל לכל שאלת מידע עניינית שאף כלי אחר אינו מכסה - נהלים, מדיניות, זכאות, " +
          "מועדי מבחנים/בחינות, ציונים, ערעורים, פטורים, שכר לימוד, מעבר בין תארים, וכל שאלה עניינית אחרת. " +
          "השתמש בו תמיד כשהמשתמש מבקש מידע ואין כלי ספציפי מתאים יותר. " +
          "אל תשתמש עבור ברכות, טקסט חסר משמעות, שיחת חולין או בקשות זדוניות - אותם יש להשאיר ללא כלי.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "העתק/י את שאלת המשתמש מילה במילה כפי שנשאלה. אל תנסח/י מחדש ואל תמציא/י שאלה אחרת.",
            },
          },
          required: ["query"],
        },
      },
    },
    run: runSearchKnowledgeBase,
  },
];

/* ---------- router ---------- */

const BASE_SYSTEM =
  "אתה עוזר אקדמי למחלקה לביוטכנולוגיה במכללת בראודה. " +
  "בחר בכלי המתאים ביותר לשאלת המשתמש. אם אף כלי אינו מתאים, אל תזמן כלי - " +
  "ענה במשפט קצר שאין לך מידע על כך.";

// The LLM picks tools from static descriptions and has no knowledge of the
// actual catalog, so a bare or partial course name matches no description and is
// dropped. Detecting real courses deterministically and telling the model closes
// that gap and fixes the arg (it uses the exact name/code instead of guessing).
function courseHint(detected) {
  if (!detected.length) return "";
  const list = detected.slice(0, 3).map((c) => `${c.courseName} (${c.courseCode})`).join(", ");
  return (
    ` שים לב: השאלה מזכירה קורס/ים קיימים מהשנתון: ${list}. ` +
    "אם השאלה עוסקת בקורס זה, בחר בכלי הקורס המתאים: get_course_info למידע כללי / קוד / נ\"ז / שעות / סמסטר, " +
    "get_prerequisites לקורסי קדם, get_courses_requiring לכיוון ההפוך, get_course_relations ליחס בין שני קורסים. " +
    "אם לא מבוקש פרט ספציפי אלא הקורס עצמו - השתמש ב-get_course_info. העבר את שם או קוד הקורס בדיוק כפי שמופיע כאן."
  );
}

// A confident, single course to fall back to when the model finds no tool or the
// chosen tool produced no real answer. Ambiguous multi-matches (e.g. a bare
// "כימיה" that fits many courses) are intentionally left unresolved.
function courseCardResult(detected, source) {
  const c = detected[0];
  return { type: "tool", tool: "get_course_info", args: { course: c.courseCode }, html: buildCourseInfoHtml(c), source };
}

export async function routeWithTools(question, yearbookId) {
  const courses = await getAllCoursesCached(yearbookId);
  const detected = findCoursesInText(question, courses);

  const msg = await callLLMTools(
    [
      { role: "system", content: BASE_SYSTEM + courseHint(detected) },
      { role: "user", content: question },
    ],
    TOOLS.map((t) => t.schema)
  );

  if (!msg) {
    return { type: "error", html: `<div class="text-sm">⚠️ שגיאה בעיבוד השאלה.</div>` };
  }

  const call = msg.tool_calls?.[0];
  if (!call) {
    // No tool matched. If the question names a real course, answer with its info
    // card instead of admitting no answer.
    if (detected.length) return courseCardResult(detected, "course_fallback_no_tool");
    return { type: "no_tool", html: NO_ANSWER_HTML };
  }

  const tool = TOOLS.find((t) => t.schema.function.name === call.function.name);
  let args = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    // executor handles missing fields
  }

  // An executor returns either an HTML string (answered) or
  // { html, answered:false, source } to signal it produced no real answer.
  const out = await tool.run(args, { yearbookId });
  if (typeof out === "object" && out?.answered === false) {
    // e.g. a KB miss. If the question names a real course, prefer its info card
    // over logging the question as unanswered.
    if (detected.length) return courseCardResult(detected, "course_fallback_kb_miss");
    return { type: "no_answer", tool: call.function.name, args, html: out.html, source: out.source || "no_answer" };
  }
  return { type: "tool", tool: call.function.name, args, html: out };
}
