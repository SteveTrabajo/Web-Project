import { callLLMTools } from "../../services/llm.js";
import { getAllCoursesCached, matchCourse, getRelationIndex } from "../../services/courseData.js";
import { ragCuratedAnswer } from "../../services/curatedRag.js";
import { getLatestYearId, getAllLabs, filterLabs, findNextLab, renderLabsHtml } from "../../services/labsData.js";
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
  return renderLabsHtml(labs);
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
          "קישורי הדרכה, תנאי סטאז'/התמחות, פטורים/חריגים, אנשי קשר לרישום, ואחראי מעבדות (אנשי קשר - לא לוח הזמנים). " +
          "השתמש לשאלות על תהליך הרישום ומועדיו. אל תשתמש עבור מועדי/לוח מעבדות (לכך יש כלי נפרד).",
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
                "contacts=אנשי קשר לרישום, labs=אחראי מעבדות (אנשי קשר), general=כללי.",
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
          "מחזיר מועדי מעבדות (מעבדה = lab) - תאריך, יום, שעה, קבוצה ומרצה. השתמש כאשר המשתמש שואל על לוח מעבדות: " +
          "'מתי המעבדה של X', 'המעבדה הבאה', 'אילו מעבדות יש ביום ה', מעבדות של מרצה מסוים וכו'. " +
          "אך ורק למעבדות - אל תשתמש למועדי מבחנים/בחינות (מועד א', מועד ב', מועד ג'), אלה אינם מעבדות. " +
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
            query: { type: "string", description: "שאלת המשתמש, מנוסחת כפי שנשאלה." },
          },
          required: ["query"],
        },
      },
    },
    run: runSearchKnowledgeBase,
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
    // No tool matched: admit no answer rather than echo possibly-hallucinated text.
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
    return { type: "no_answer", tool: call.function.name, args, html: out.html, source: out.source || "no_answer" };
  }
  return { type: "tool", tool: call.function.name, args, html: out };
}
