import express from "express";
import { callLLM, callLLMJson, embed } from "../../services/llm.js";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { db } from "../../server.js";
import askLabs from "./askLabs.js";
import {
  isRegistrationQuestion,
  classifyRegistrationIntent,
  refineRegistrationIntent,
  extractSemesterNumber,
  getRegDoc,
  getAllRegDocs,
  buildRegistrationAnswer,
  buildAllAdvisorsAnswer,
  buildAllLabsAnswer,
  getRegistrationSummary,
  getContactsSummary,
  findContactsByQuery,
  formatRegistrationWindow,
} from "./registration.service.js";

const router = express.Router();

/* =============================
   Utils (MUST be defined BEFORE usage)
============================= */

function normalizeHebrew(s = "") {
  return String(s)
    .replace(/["׳״'`]/g, "")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}
const PREREQ_KEYWORDS = [
  "קדם",
  "דרישת קדם",
  "דרישות קדם",
  "קורסי קדם",
  "מה צריך לפני",
  "לפני",
  "תנאי",
  "דרישות",
  "מה צריך כדי",
];

function escapeRegex(str = "") {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const isCourseCode = (s) => /^\d{5,6}$/.test(String(s || "").trim());

function extractCourseCode(question = "") {
  const m = String(question).match(/\b\d{5,6}\b/);
  return m ? m[0] : null;
}

/* =============================
   Intent detectors (non-reg / labs)
============================= */

function isLabQuestion(question = "", qLower = null) {
  const q = qLower ?? String(question).toLowerCase();

  const labWords = ["מעבדה", "מעבדות", "מע"];
  const timeWords = [
    "מתי",
    "איזה",
    "יום",
    "תאריך",
    "היום",
    "מחר",
    "השבוע",
    "שבוע הבא",
    "באיזה",
    "לוח",
    "זמן",
    "מפגש",
  ];

  return labWords.some((w) => q.includes(w)) && timeWords.some((t) => q.includes(t));
}

const PARALLEL_KEYWORDS = ["במקביל", "צמוד", "עם"];

function isAcademicCourseIntent(question = "", qNorm = null) {
  const q = qNorm ?? normalizeHebrew(question);
  return (
    PREREQ_KEYWORDS.some((k) => q.includes(normalizeHebrew(k))) ||
    PARALLEL_KEYWORDS.some((k) => q.includes(normalizeHebrew(k))) ||
    q.includes(normalizeHebrew("אפשר ללמוד")) ||
    q.includes(normalizeHebrew("אפשר לקחת"))
  );
}


function detectGreeting(question = "", qNorm = null) {
  const q = qNorm ?? normalizeHebrew(question);

  return ["היי", "הי", "שלום", "אהלן", "הלו", "בוקר טוב", "ערב טוב", "מה נשמע"].some(
    (g) => q === normalizeHebrew(g)
  );
}

// Topics students ask about that the bot has no data for (exams, grades,
// syllabus). Detected early so a course mention in the same question does
// not fall through to an unrelated course answer.
const UNSUPPORTED_TOPICS = [
  // "מועד/מועדי א/ב" with a word boundary so "מועד בשבוע" is not read as an exam sitting
  { label: "מועדי מבחנים", keywords: ["מבחן", "מבחנים", "בחינה", "בחינות"], patterns: [/מועדי? [אב]['׳]?(\s|$)/] },
  { label: "ציונים", keywords: ["ציון", "ציונים"] },
  { label: "סילבוס", keywords: ["סילבוס", "סילאבוס"] },
  // Intercepted before registration routing, which otherwise misreads any
  // "מתי" question as a registration-window ask
  {
    label: "מועדי ביטול קורסים",
    keywords: ["ביטול", "לבטל", "מבטלים"],
    hint: 'את טופס הביטול/רישום חריג אפשר למצוא דרך הנושא "רישום חריג" בתפריט למטה.',
  },
];

function detectUnsupportedTopic(question = "", qNorm = null) {
  const q = qNorm ?? normalizeHebrew(question);
  for (const t of UNSUPPORTED_TOPICS) {
    if (t.keywords.some((k) => q.includes(normalizeHebrew(k)))) return t;
    if ((t.patterns || []).some((p) => p.test(q))) return t;
  }
  return null;
}

function buildUnsupportedTopicAnswer(topic) {
  return `
    <div class="text-sm">
      ℹ️ אין לי כרגע מידע על ${topic.label} - ניתן לבדוק זאת בתחנת המידע לסטודנט.<br/>
      ${topic.hint ? `${topic.hint}<br/>` : ""}<br/>
      <b class="bot-subtitle">אפשר לשאול אותי על:</b><br/>
      • קורסי קדם ודרישות בין קורסים<br/>
      • לוחות מעבדה ומועדי מפגשים<br/>
      • הנחיות רישום, יועצים ואנשי קשר
    </div>`;
}

function isCourseLookupQuestion(question = "", qNorm = null) {
  const q = qNorm ?? normalizeHebrew(question);

  const lookupPhrases = [
    "מה הקוד של",
    "מה קוד של",
    "מה מספר הקורס",
    "מה מספר של הקורס",
    "מספר קורס",
    "קוד קורס",
    "קוד של",
    "מה השם של",
    "מה שם הקורס",
    "איך קוראים לקורס",
  ].map(normalizeHebrew);

  if (lookupPhrases.some((p) => q.includes(p))) return true;

  const code = extractCourseCode(question);
  if (code && (q.includes(normalizeHebrew("מה שם")) || q.includes(normalizeHebrew("איזה קורס")))) {
    return true;
  }

  return false;
}

// True when the question is only a course name/code (plus filler like "קורס"),
// with no actual ask - the bot should clarify instead of guessing an intent.
function isBareCourseMention(qNorm, course) {
  if (!course) return false;
  const leftovers = String(qNorm)
    .replaceAll(course.nameNorm, " ")
    .replaceAll(course.codeNorm, " ")
    .replace(/[?!,:;()]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["קורס", "הקורס", "על", "לגבי"].includes(w));
  return leftovers.length === 0;
}

function detectPrerequisitesFallback(question = "", qNorm = null) {
  const q = qNorm ?? normalizeHebrew(question);
  return PREREQ_KEYWORDS.some((k) => q.includes(normalizeHebrew(k)));
}

// Reverse direction: "which courses REQUIRE X" - must be told apart from
// "what does X require", or the prerequisite branch answers backwards.
const REVERSE_PREREQ_PHRASES = [
  "לאילו קורסים",
  "לאיזה קורסים",
  "אילו קורסים דורשים",
  "איזה קורסים דורשים",
  "היא דרישת קדם",
  "הוא דרישת קדם",
  "היא קדם",
  "הוא קדם",
  "נדרש עבור",
  "נדרשת עבור",
  "אפשר לקחת אחרי",
  "לומדים אחרי",
];

function isReversePrereqQuestion(qNorm) {
  return REVERSE_PREREQ_PHRASES.some((p) => qNorm.includes(normalizeHebrew(p)));
}


function detectIntent(question = "", qNorm = null) {
  const s = qNorm ?? normalizeHebrew(question);
  if (s.includes("לפני") || s.includes("קדם")) return "before";
  if (s.includes("במקביל") || s.includes("צמוד") || s.includes("עם")) return "parallel";
  return "general";
}

/* =============================
   Cache: Courses (Firestore)
============================= */

const _coursesCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getAllCoursesCached(yearbookId) {
  const now = Date.now();
  const cached = _coursesCache.get(yearbookId);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.courses;

  const coursesRef = db.collection("yearbooks").doc(yearbookId).collection("requiredCourses");
  const semestersSnap = await coursesRef.get();

  const semesterDocs = semestersSnap.docs;
  const coursePromises = semesterDocs.map((sem) => sem.ref.collection("courses").get());
  const coursesSnaps = await Promise.all(coursePromises);

  const allCourses = [];
  coursesSnaps.forEach((snap, idx) => {
    const semesterKey = semesterDocs[idx].id;
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const courseCode = String(data.courseCode || doc.id);
      const courseName = String(data.courseName || "");
      allCourses.push({
        courseCode,
        courseName,
        semesterKey,
        nameNorm: normalizeHebrew(courseName),
        codeNorm: courseCode.replace(/\s+/g, ""),
      });
    });
  });

  _coursesCache.set(yearbookId, { ts: now, courses: allCourses });
  return allCourses;
}

/* =============================
   Matching / Extraction
============================= */

function matchCourse(raw, courses, nameIndex) {
  if (!raw) return null;
  const s = String(raw).trim();

  if (isCourseCode(s)) return courses.find((c) => c.courseCode === s) || null;

  const n = normalizeHebrew(s);
  if (!n) return null;

  if (nameIndex?.has(n)) return nameIndex.get(n);

  if (nameIndex) {
    for (const [key, course] of nameIndex.entries()) {
      if (key.includes(n) || n.includes(key)) return course;
    }
  }

  return null;
}

function extractMultipleCourses(question, allCourses, qNorm = null) {
  const q = qNorm ?? normalizeHebrew(question);
  const matches = [];

  for (const c of allCourses) {
    if (!c.nameNorm) continue;

    const words = c.nameNorm.split(" ").filter(w => w.length >= 2);

    const found = words.every(w =>
      new RegExp(`\\b${escapeRegex(w)}\\b`, "i").test(q)
    );

    if (found) matches.push(c);
  }

  return matches;
}




/* =============================
   Firestore relations
============================= */
const _relationTypeCache = new Map();
const RELATION_CACHE_TTL_MS = 5 * 60 * 1000;

// Reverse index prereqCode -> courses that list it as a relation, built from
// one collectionGroup fetch per yearbook and cached like the other lookups.
const _reverseRelationsCache = new Map();

async function getCoursesRequiringCached(yearbookId, courseCode) {
  const now = Date.now();
  let cached = _reverseRelationsCache.get(yearbookId);

  if (!cached || now - cached.ts >= RELATION_CACHE_TTL_MS) {
    const snap = await db.collectionGroup("relations").get();
    const byPrereq = new Map();
    for (const doc of snap.docs) {
      if (!doc.ref.path.startsWith(`yearbooks/${yearbookId}/`)) continue;
      const dependentCode = doc.ref.parent.parent?.id;
      if (!dependentCode) continue;
      if (!byPrereq.has(doc.id)) byPrereq.set(doc.id, []);
      byPrereq.get(doc.id).push({ dependentCode, type: doc.data()?.type || null });
    }
    cached = { ts: now, byPrereq };
    _reverseRelationsCache.set(yearbookId, cached);
  }

  return cached.byPrereq.get(courseCode) || [];
}

async function getRelationType(yearbookId, courseA_code, courseB_code) {
  const key = `${yearbookId}:${courseA_code}:${courseB_code}`;
  const now = Date.now();
  const cached = _relationTypeCache.get(key);
  if (cached && now - cached.ts < RELATION_CACHE_TTL_MS) return cached.val;

  // Use the course cache to find the semester key directly — no full semester scan
  const courses = await getAllCoursesCached(yearbookId);
  const courseA = courses.find((c) => c.courseCode === courseA_code);

  if (!courseA?.semesterKey) {
    _relationTypeCache.set(key, { ts: now, val: null });
    return null;
  }

  const relSnap = await db
    .collection("yearbooks")
    .doc(yearbookId)
    .collection("requiredCourses")
    .doc(courseA.semesterKey)
    .collection("courses")
    .doc(courseA_code)
    .collection("relations")
    .doc(courseB_code)
    .get();

  const val = relSnap.exists ? relSnap.data()?.type || null : null;
  _relationTypeCache.set(key, { ts: now, val });
  return val;
}

// Recursive prerequisite walk — very expensive without the cache.
const _prereqCache = new Map();
const PREREQ_CACHE_TTL_MS = 5 * 60 * 1000;

async function getAllPrerequisitesRecursive(yearbookId, courseCode, visited = new Set(), courseMap = null) {
  if (visited.has(courseCode)) return [];
  visited.add(courseCode);

  // Build the course map once and pass it through all recursive calls
  if (!courseMap) {
    const courses = await getAllCoursesCached(yearbookId);
    courseMap = new Map(courses.map((c) => [c.courseCode, c]));
  }

  const course = courseMap.get(courseCode);
  if (!course?.semesterKey) return [];

  const prereqs = [];

  // Direct path query — no semester scan
  const relsSnap = await db
    .collection("yearbooks")
    .doc(yearbookId)
    .collection("requiredCourses")
    .doc(course.semesterKey)
    .collection("courses")
    .doc(courseCode)
    .collection("relations")
    .where("type", "==", "PREREQUISITE")
    .get();

  for (const doc of relsSnap.docs) {
    const prereqCode = doc.id;
    const prereqName = doc.data().courseName || prereqCode;
    prereqs.push({ code: prereqCode, name: prereqName });

    const deeper = await getAllPrerequisitesRecursive(yearbookId, prereqCode, visited, courseMap);
    prereqs.push(...deeper);
  }

  return prereqs;
}

async function getAllPrerequisitesRecursiveCached(yearbookId, courseCode) {
  const key = `${yearbookId}:${courseCode}`;
  const now = Date.now();
  const cached = _prereqCache.get(key);
  if (cached && now - cached.ts < PREREQ_CACHE_TTL_MS) return cached.data;

  const data = await getAllPrerequisitesRecursive(yearbookId, courseCode);
  _prereqCache.set(key, { ts: now, data });
  return data;
}


// Compact transcript of the latest conversation turns, used to give the
// classifier and the RAG fallback enough context to resolve follow-up questions.
function buildHistoryText(history) {
  if (!Array.isArray(history) || !history.length) return "";
  const lines = history
    .slice(-7)
    .map((m) => {
      const who = m?.role === "user" ? "סטודנט" : "בוט";
      const text = String(m?.text || "").replace(/\s+/g, " ").trim().slice(0, 280);
      return text ? `${who}: ${text}` : null;
    })
    .filter(Boolean);
  const joined = lines.join("\n");
  return joined.length > 2000 ? joined.slice(-2000) : joined;
}

async function classifyQuestion(question, historyText = "") {
  const classifierPrompt = `
החזירי JSON בלבד:

{
  "kind": "lookup" | "relation" | "prerequisites",
  "courses": ["רשימת קורסים"],
  "intent": "before" | "parallel" | "general"
}

הגדרות:
lookup → קורס אחד (שם/קוד)
prerequisites → קורסי קדם של קורס אחד
relation → קשר בין שני קורסים או יותר (לפני/במקביל/כללי)

כללי קורס ב-courses רק אם השאלה הנוכחית באמת עוסקת בקורס (דרישות קדם, קשר בין
קורסים, קוד/שם של קורס). אם זו שאלת המשך עם התייחסות עקיפה לקורס שהוזכר קודם
(למשל "ומה הקדם שלו?", "ומה לגביו?", "ואותו קורס?"), זהי את הקורס מההקשר וכללי את שמו.
אבל אם השאלה אינה על קורס - למשל שאלה על השיחה עצמה ("מה שאלתי קודם?", "מה אמרת?")
או נושא כללי - החזירי courses ריק: [].
${historyText ? `\nשיחה קודמת (להקשר בלבד):\n${historyText}\n` : ""}
שאלה נוכחית:
"${question}"
`;
  return callLLMJson(classifierPrompt);
}

/* =============================
   Emotion detection (LLM)
============================= */

function buildEmotionPrompt(question) {
  return `
את מערכת שמזהה מצוקה רגשית של סטודנטים.

החזירי JSON בלבד בפורמט:
{ "intent": "emotional_support" | "other" }

סווגי כ-"emotional_support" אם יש ביטוי אישי של קושי,
גם אם מוזכרים לימודים או קורסים.

דוגמאות למצוקה:
- קשה לי
- אני לא מצליחה
- אני תקועה
- אני טובעת
- לא הולך לי
- אני בלחץ
- לא מבינה כלום

הביטויים יכולים להופיע בכל מין (למשל גם "אני לא מצליח", "אני תקוע", "אני לא מבין").

סווגי כ-"other" רק אם השאלה היא מידע אקדמי טכני בלבד
(קוד קורס, דרישות קדם, לוח זמנים).

שאלה:
"${question}"
`;
}

async function detectEmotion(question) {
  return callLLMJson(buildEmotionPrompt(question));
}

/* =============================
   Curated answers (admin-published Q&A)
   Consulted only as a safety net, right before the generic fallback.
============================= */

const _curatedCache = { ts: 0, items: [] };
const CURATED_TTL = 5 * 60 * 1000;

async function getCuratedAnswersCached() {
  const now = Date.now();
  if (_curatedCache.ts && now - _curatedCache.ts < CURATED_TTL) return _curatedCache.items;
  try {
    const snap = await db
      .collection("curatedAnswers")
      .where("status", "==", "published")
      .get();
    _curatedCache.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    _curatedCache.ts = now;
  } catch {
    // keep stale cache on failure
  }
  return _curatedCache.items;
}

/* =============================
   Semantic RAG over curated answers (embeddings)
============================= */

const RAG_THRESHOLD = 0.78; // min cosine similarity to treat a curated answer as a confident hit

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function hashText(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

// Curated-answer vectors cached by doc id + text hash, so each unique text is
// embedded only once and reused across the 5-minute curated cache windows.
const _embedCache = new Map();

async function getCuratedEmbedded() {
  const items = await getCuratedAnswersCached();
  const out = [];
  for (const a of items) {
    const text = `${a.question || ""} ${(a.keywords || []).join(" ")}`.trim();
    if (!text) continue;
    const h = hashText(text);
    let entry = _embedCache.get(a.id);
    if (!entry || entry.hash !== h) {
      const vector = await embed(text);
      if (!vector) continue;
      entry = { hash: h, vector };
      _embedCache.set(a.id, entry);
    }
    out.push({ ...a, vector: entry.vector });
  }
  return out;
}

// Best curated answer above the similarity threshold for this yearbook, or null.
async function ragCuratedAnswer(question, yearbookId) {
  const qVec = await embed(question);
  if (!qVec) return null;
  const corpus = await getCuratedEmbedded();
  let best = null;
  let bestSim = 0;
  for (const a of corpus) {
    if (a.yearbook && a.yearbook !== yearbookId) continue;
    const sim = cosineSim(qVec, a.vector);
    if (sim > bestSim) { bestSim = sim; best = a; }
  }
  return best && bestSim >= RAG_THRESHOLD ? best : null;
}

/* =============================
   Forms cache (filesystem)
============================= */

const _formsCache = { ts: 0, items: [] };
const FORMS_TTL = 5 * 60 * 1000; // 5 minutes time to live
const __dirname_ask = path.dirname(fileURLToPath(import.meta.url));

async function getFormsCached() {
  const now = Date.now();
  if (_formsCache.ts && now - _formsCache.ts < FORMS_TTL) return _formsCache.items;
  try {
    const raw = await readFile(
      path.resolve(__dirname_ask, "../../files/forms.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    _formsCache.items = (Array.isArray(parsed) ? parsed : []).map((f) => ({
      ...f,
      url: "/files/" + encodeURIComponent(f.filename),
    }));
    _formsCache.ts = now;
  } catch {
    // keep stale or empty
  }
  return _formsCache.items;
}

/* =============================
   Reserves (miluim) label map
   Mirrors the group definitions in Bot.jsx so the RAG prompt
   can tell the LLM which plan and eligibility group the student is in.
============================= */
const RESERVES_MITVE_LABELS = {
  mitve_tashpah_sem_a: 'מתווה תשפ"ד - סמסטר א',
  mitve_tashpah_sem_b: 'מתווה תשפ"ד - סמסטר ב',
  mitve_tashpeh_sem_a: 'מתווה תשפ"ה - סמסטר א',
  mitve_tashpeh_sem_b: 'מתווה תשפ"ה - סמסטר ב',
  mitve_tashpuv_sem_a: 'מתווה תשפ"ו - סמסטר א',
};

const RESERVES_GROUP_LABELS = {
  mitve_tashpah_sem_a: {
    group_1: "שורתו 7 ימים או יותר מתחילת הסמסטר",
    group_2: "שורתו עד 7 ימים מתחילת הסמסטר",
    group_3: "בני/בנות זוג של מילואימניק/ית",
    group_4: "נפגעו בצורה משמעותית וממושכת מהמצב",
    group_5: "שאר הסטודנטים (ללא שירות מילואים)",
  },
  mitve_tashpah_sem_b: {
    group_11: "שירות במילואים לתקופה של 100 ימים לפחות",
    group_22: "שירות במילואים לתקופה של 61 עד 99 ימים",
    group_33: "שירות במילואים לתקופה של 30 עד 60 ימים",
    group_44: "סטודנטים ובני זוג שנפגעו בצורה משמעותית ומפונים",
  },
  mitve_tashpeh_sem_a: {
    group_111: "שירות של 35 ימים ומעלה במצטבר / משרתים בקבע ייעודי קדמי",
    group_222: "סטודנטים עם הורות לילד עד גיל 13 השייכים לאחת מהקבוצות",
    group_333: "שירות במילואים של פחות מ-21 ימים במצטבר במהלך הסמסטר",
    group_444: "נפגעו בצורה משמעותית במלחמה ומפונים, כולל בני/בנות זוג",
  },
  mitve_tashpeh_sem_b: {
    group_111: "שירות של 35 ימים ומעלה במצטבר / משרתים בקבע ייעודי קדמי",
    group_222: "סטודנטים עם הורות לילד עד גיל 13 השייכים לאחת מהקבוצות",
    group_333: "שירות במילואים של פחות מ-21 ימים במצטבר במהלך הסמסטר",
    group_444: "נפגעו בצורה משמעותית במלחמה ומפונים, כולל בני/בנות זוג",
    group_555: "שירות של 300 ימים ומעלה / לוחמים בייעוד קדמי מעל 200 ימים",
  },
  mitve_tashpuv_sem_a: {
    group_11_v: "שירות מילואים של 35 ימים ומעלה בסמסטר / סטודנט הורה לילד עד גיל 13 / משרתים בקבע ביחידות ייעוד קדמי",
    group_22_v: "שירות מילואים בין 21 ל-35 ימים בסמסטר / מעל 35 ימים בשנה אקדמית",
    group_33_v: "משרתי מילואים קצרי טווח (עד 21 ימים בסמסטר) וסטודנטים הורים",
    group_44_v: "פצועי/ות, שורדי/ות, בני משפחה של חללים, מקרים חריגים",
    group_55_v: "קבע ייעוד קדמי / הורים עם בן/בת זוג בשירות מעל 300 ימים מתחילת המלחמה",
  },
};

/* =============================
   Generative fallback (LLM)
============================= */
async function buildRagContext(yearbookId, semesterNum, reservesMitve, reservesGroup) {
  // Order matters: the course list can be long and is the part safe to drop on
  // truncation, so contacts and registration info go first.
  const parts = [];

  // Contacts (head of department, secretariat, advisors, labs...) are
  // department-wide, so include them regardless of the selected semester.
  try {
    const contacts = await getContactsSummary();
    if (contacts) parts.push(contacts);
  } catch {}

  if (semesterNum) {
    try {
      const summary = await getRegistrationSummary(semesterNum);
      if (summary) parts.push(summary);
    } catch {}
  }

  try {
    const courses = await getAllCoursesCached(yearbookId);
    const bySemester = {};
    for (const c of courses) {
      const key = c.semesterKey || "unknown";
      if (!bySemester[key]) bySemester[key] = [];
      bySemester[key].push(`${c.courseName} (${c.courseCode})`);
    }
    const courseLines = Object.entries(bySemester)
      .map(([sem, names]) => `סמסטר ${sem}: ${names.join(", ")}`)
      .join("\n");
    if (courseLines) parts.push(`קורסים בשנתון:\n${courseLines}`);
  } catch {}

  if (reservesMitve && reservesGroup) {
    const mitveLabel = RESERVES_MITVE_LABELS[reservesMitve] || reservesMitve;
    const groupLabel = RESERVES_GROUP_LABELS[reservesMitve]?.[reservesGroup] || reservesGroup;
    parts.push(`מידע על הסטודנט - מתווה מילואים: ${mitveLabel}\nקבוצת זכאות: ${groupLabel}`);
  }

  const full = parts.join("\n\n");
  return full.length > 4000 ? full.slice(0, 4000) + "..." : full;
}

// Generative fallback, used ONLY when semantic RAG misses. Returns a structured
// result so the route can answer, redirect to an advisor, or flag off-topic - the
// study-relevance decision is folded into this single LLM call (no extra call).
async function answerOrRoute(question, yearbookId, semesterNum, reservesMitve, reservesGroup, historyText = "") {
  const context = await buildRagContext(yearbookId, semesterNum, reservesMitve, reservesGroup);
  const prompt = `אתה BIO-BOT, עוזר אקדמי לסטודנטים לביוטכנולוגיה במכללת בראודה.
ענה בעברית בלבד ורק על נושאים אקדמיים הקשורים לתואר ולמכללה.
פנה תמיד בלשון נייטרלית הפונה לשני המינים (למשל: את/ה, תוכל/י, מומלץ, אפשר) - אל תניח מגדר.
אם השאלה היא שאלת המשך, היעזר בשיחה הקודמת כדי להבין למה היא מתייחסת.

הנחיות פלט - חשוב מאוד:
- אם אתה יכול לענות מתוך המידע שסופק - החזר את התשובה כטקסט רגיל.
- אם אינך יכול לענות אך השאלה קשורה ללימודים / לתואר / למכללה - החזר בדיוק את המילה: NEED_ADVISOR
- אם השאלה אינה קשורה ללימודים כלל - החזר בדיוק את המילה: OFF_TOPIC

${historyText ? `שיחה קודמת:\n${historyText}\n\n` : ""}${context ? `מידע על השנתון:\n${context}\n\n` : ""}שאלת הסטודנט: "${question}"`;

  const text = await callLLM(prompt);
  if (!text) return { type: "advisor" }; // API failure -> help the (likely lost) student
  const t = text.trim();
  if (t.startsWith("NEED_ADVISOR")) return { type: "advisor" };
  if (t.startsWith("OFF_TOPIC")) return { type: "offtopic" };
  return { type: "answer", html: `<div class="text-sm leading-6">${t.replace(/\n/g, "<br/>")}</div>` };
}

/* =============================
   Advisor redirect (best-effort from context)
============================= */

// Pill button that launches the interactive advisor picker (window.startAdvisorFlow in Bot.jsx).
const ADVISOR_PICKER_BTN =
  "inline-block px-4 py-2 rounded-full border border-bio-green bg-surface-card text-bio-green text-sm font-medium hover:bg-surface-raised transition-colors shadow-sm";

// Direct answer for a contact-role question, listing each matched person.
function buildContactsAnswer(contacts) {
  const rows = contacts
    .map((c) => {
      const role = c.role ? ` – ${c.role}` : "";
      const email = c.email ? `<br/><a href="mailto:${c.email}">${c.email}</a>` : "";
      const phone = c.phone ? `<br/>📞 <span dir="ltr">${c.phone}</span>` : "";
      return `<div class="mb-2"><b>${c.name}</b>${role}${email}${phone}</div>`;
    })
    .join("");
  return `<div dir="rtl" class="text-sm leading-6 text-right">${rows}</div>`;
}

// Study-related question we couldn't answer -> nudge the student into the advisor picker.
function buildAdvisorRedirect() {
  return `<div dir="rtl" class="text-sm leading-6 text-right">
    🤝 לא מצאתי תשובה מדויקת לשאלה. כדי לקבל עזרה אישית מומלץ לפנות ליועץ/ת האקדמי/ת שלך:<br/><br/>
    <button onclick="window.startAdvisorFlow?.()" class="${ADVISOR_PICKER_BTN}">בחירת יועץ אקדמי 👈</button>
  </div>`;
}

/* =============================
   Anonymous usage analytics
============================= */

async function logUsageEvent({
  question,
  yearbook,
  semester,
  topic,
  answerSource,
  wasAnswered,
  detectedCourses = [],
}) {
  try {
    await db.collection("usageEvents").add({
      question: String(question || "").slice(0, 1000),
      normalizedQuestion: normalizeHebrew(question),
      yearbook: yearbook || null,
      semester: semester || null,
      topic: topic || null,
      answerSource,
      wasAnswered,
      detectedCourses: detectedCourses
        .map((c) => String(c.courseCode || c).slice(0, 30))
        .slice(0, 10),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // never break the bot response
  }
}

// Auto-saves the question to unansweredQuestions when the bot reaches the fallback.
// Deduplicates against other auto-saved entries by normalizedQuestion.
async function autoSaveUnanswered({ question, yearbook, semester, topic, reason = "fallback_no_answer" }) {
  try {
    const qNorm = normalizeHebrew(question);
    const dup = await db
      .collection("unansweredQuestions")
      .where("normalizedQuestion", "==", qNorm)
      .limit(1)
      .get();
    if (!dup.empty) return;
    await db.collection("unansweredQuestions").add({
      questions: [String(question || "").slice(0, 1000)],
      normalizedQuestion: qNorm,
      yearbook: yearbook || null,
      semester: semester || null,
      topic: topic || null,
      reasons: [reason],
      comment: "",
      createdAt: new Date().toISOString(),
      status: "open",
    });
  } catch {
    // never break the bot response
  }
}

/* =============================
   Route: /ask
============================= */

router.post("/ask", async (req, res) => {
  try {
    const { yearbookId, question, semester: clientSemester, topic: clientTopic, reservesMitve, reservesGroup, history } = req.body || {};
    if (!question || !yearbookId) return res.status(400).json({ html: "❌ חסרה שאלה" });

    const qNorm = normalizeHebrew(question);
    const qLower = String(question).toLowerCase();
    const historyText = buildHistoryText(history);

    if (detectGreeting(question, qNorm)) {
      return res.json({
        html: `
          <div class="text-sm">
            👋 היי!<br/>
            איך אפשר לעזור לך היום? 😊
          </div>
        `,
      });
    }

    // Topics the bot has no data for. A curated admin answer (תשובות מוכנות)
    // overrides this, so covering such a topic later needs no code change -
    // the keyword list only routes to an honest fallback message.
    const unsupportedTopic = detectUnsupportedTopic(question, qNorm);
    if (unsupportedTopic) {
      const curated = await ragCuratedAnswer(question, yearbookId);
      if (curated) {
        logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "rag_curated", wasAnswered: true });
        return res.json({ html: curated.answerHtml });
      }
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "unsupported_topic", wasAnswered: false });
      autoSaveUnanswered({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, reason: "unsupported_topic" });
      return res.json({ html: buildUnsupportedTopicAnswer(unsupportedTopic) });
    }

    // 1) Labs schedule
    if (isLabQuestion(question, qLower)) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "labs", wasAnswered: true });
      return askLabs(req, res);
    }

    // 2) Registration
    if (
      isRegistrationQuestion(question) &&
      !isAcademicCourseIntent(question, qNorm) &&
      !isCourseLookupQuestion(question, qNorm)
    ) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "registration", wasAnswered: true });
      const intentObj = await classifyRegistrationIntent(question);
      const finalIntent = refineRegistrationIntent(intentObj?.intent, question) || "general";
      const semNum = extractSemesterNumber(question);

      if (finalIntent === "window" && !semNum) {
        const allDocs = await getAllRegDocs();

        const html = `
          <div class="text-sm leading-6">
            <b class="bot-title">⏰ חלונות רישום לכל הסמסטרים</b><br/><br/>
            ${allDocs
              .map(
                (d) => `
              <div class="mb-2">
                <b class="bot-subtitle">סמסטר ${d.semesterNumber}</b>
                ${d.audience?.cohortText ? ` (${d.audience.cohortText})` : ""}<br/>
                ${formatRegistrationWindow(d.registrationWindow)}
              </div>
            `
              )
              .join("")}
          </div>
        `;
        return res.json({ html });
      }

      if (!semNum) {
        const allDocs = await getAllRegDocs();

        if (finalIntent === "credits") {
          return res.json({
            html: `
              <div class="text-sm">
                <b class="bot-title">נקודות זכות לתואר</b><br/>
                נדרש מינימום 165 נ״ז
              </div>
            `,
          });
        }

        if (finalIntent === "exemptions") {
          return res.json({
            html: `
              <div class="text-sm">
                ℹ️ פטורים וחריגים מטופלים מול הגורם האקדמי הרלוונטי.<br/>
                אנא ציין/י סמסטר או פנה/י ליועץ/ת האקדמי/ת.
              </div>
            `,
          });
        }

        if (finalIntent === "contacts") {
          return res.json({
            html: `
              <div class="text-sm">
                ℹ️ לפניות בנושא רישום ניתן לפנות ליועצים האקדמיים
                או לתמיכת הרישום של הסמסטר הרלוונטי.
              </div>
            `,
          });
        }

        if (finalIntent === "advisors") return res.json({ html: buildAllAdvisorsAnswer(allDocs) });
        if (finalIntent === "labs") return res.json({ html: buildAllLabsAnswer(allDocs) });

        if (finalIntent === "mentors") {
          const docsWithMentors = allDocs.filter((d) => (d.contacts?.mentors || []).length > 0);

          if (!docsWithMentors.length) {
            return res.json({ html: `<div class="text-sm">ℹ️ אין סטודנט/ית מלווה בשנתון זה.</div>` });
          }

          if (docsWithMentors.length === 1) {
            const d = docsWithMentors[0];
            const m = d.contacts.mentors[0];

            return res.json({
              html: `
                <div class="text-sm leading-6">
                  👩‍🎓 <b class="bot-title">סטודנט/ית מלווה יש רק בסמסטר ${d.semesterNumber}</b><br/><br/>
                  • <b>${m.name}</b><br/>
                  <a href="mailto:${m.email}">${m.email}</a>
                </div>
              `,
            });
          }

          return res.json({ html: `<div class="text-sm">ℹ️ יש מספר מלווים. אנא ציין/י סמסטר.</div>` });
        }

        if (finalIntent === "links") {
          const docsWithLinks = allDocs.filter((d) => (d.links || []).length > 0);

          if (!docsWithLinks.length) {
            return res.json({ html: `<div class="text-sm">ℹ️ לא נמצאו קישורי הדרכה.</div>` });
          }

          if (docsWithLinks.length === 1) {
            return res.json({ html: await buildRegistrationAnswer("links", docsWithLinks[0]) });
          }

          return res.json({
            html: `
              <div class="text-sm">
                <b class="bot-title">קישורי הדרכה לפי סמסטר</b><br/><br/>
                ${docsWithLinks
                  .map(
                    (d) =>
                      `<b class="bot-subtitle">סמסטר ${d.semesterNumber}</b><br/>` +
                      d.links
                        .map((l) => `• <a href="${l.url}" target="_blank">${l.label}</a>`)
                        .join("<br/>")
                  )
                  .join("<br/><br/>")}
              </div>
            `,
          });
        }

        if (finalIntent === "internship") {
          return res.json({
            html: `<div class="text-sm">ℹ️ תנאי סטאז' משתנים לפי סמסטר. אנא ציין/י סמסטר.</div>`,
          });
        }

        if (finalIntent === "general") {
          return res.json({
            html: `
              <div class="text-sm">
                ℹ️ ניתן לשאול על רישום: חלון רישום, יועצים, מעבדות (אנשי קשר),
                מלווה, נקודות זכות, קישורים או תנאי סטאז'.
              </div>
            `,
          });
        }

        return res.json({ html: `<div class="text-sm">ℹ️ אנא ציין/י סמסטר (לדוגמה: סמסטר 2)</div>` });
      }

      const regDoc = await getRegDoc(semNum);
      if (!regDoc) {
        return res.json({ html: `<div class="text-sm">❌ לא מצאתי הנחיות רישום לסמסטר ${semNum}.</div>` });
      }

      if (finalIntent === "internship") {
        const rules = (regDoc.keyRules || []).filter((r) => r.code?.includes("INTERNSHIP"));
        if (!rules.length) return res.json({ html: `<div class="text-sm">ℹ️ אין מידע על סטאז' בסמסטר זה.</div>` });

        return res.json({
          html: `
            <div class="text-sm">
              <b class="bot-title">תנאי סטאז' – סמסטר ${semNum}</b><br/><br/>
              ${rules.map((r) => `• ${r.text}`).join("<br/>")}
            </div>
          `,
        });
      }

      const forms = await getFormsCached();
      return res.json({ html: await buildRegistrationAnswer(finalIntent, regDoc, { forms }) });
    }

    // 3) Courses / Relations / Prereqs / Emotion (Academic)
    const allCourses = await getAllCoursesCached(yearbookId);

    // index only by nameNorm (code handled separately)
    const nameIndex = new Map();
    allCourses.forEach((c) => nameIndex.set(c.nameNorm, c));

    const detectedCourses = extractMultipleCourses(question, allCourses, qNorm);

    const [emotion, classification] = await Promise.all([detectEmotion(question), classifyQuestion(question, historyText)]);

    const llmCourses = Array.isArray(classification?.courses)
      ? classification.courses.map((c) => matchCourse(c, allCourses, nameIndex)).filter(Boolean)
      : [];

    const coursesFromQuestion = llmCourses.length ? llmCourses : detectedCourses;
    const courseMain = coursesFromQuestion[0] || null;

    // Emotion
    if (emotion?.intent === "emotional_support" && !courseMain) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "emotional", wasAnswered: true });
      return res.json({
        html: `
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
          </div>
        `,
      });
    }

    const kind = classification?.kind || null;
    const intent = classification?.intent || detectIntent(question, qNorm);

    // Reverse prerequisites: "לאילו קורסים X היא דרישת קדם" - answers with the
    // courses that require courseMain. Must precede the forward branch, which
    // would otherwise answer the mirrored question with X's own prerequisites.
    if (courseMain && isReversePrereqQuestion(qNorm)) {
      const rels = await getCoursesRequiringCached(yearbookId, courseMain.courseCode);
      const dependents = [...new Set(
        rels.filter((r) => r.type === "PREREQUISITE").map((r) => r.dependentCode)
      )];
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "courses_reverse", wasAnswered: true, detectedCourses: coursesFromQuestion });

      if (!dependents.length) {
        return res.json({
          html: `<div class="text-sm">ℹ️ <b>${courseMain.courseName}</b> לא מופיע כדרישת קדם לקורסים אחרים בשנתון.</div>`,
        });
      }

      const names = dependents.map(
        (code) => allCourses.find((c) => c.courseCode === code)?.courseName || code
      );
      return res.json({
        html: `
          <div class="text-sm leading-6">
            📘 <b class="bot-title">קורסים הדורשים את ${courseMain.courseName} כקדם</b><br/><br/>
            ${names.map((n) => `• ${n}`).join("<br/>")}
          </div>
        `,
      });
    }

    // Prerequisites (with cache)
    if (courseMain && (kind === "prerequisites" || detectPrerequisitesFallback(question, qNorm))) {
      const prereqs = await getAllPrerequisitesRecursiveCached(yearbookId, courseMain.courseCode);
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "courses", wasAnswered: true, detectedCourses: coursesFromQuestion });

      if (!prereqs.length) {
        return res.json({
          html: `<div class="text-sm">ℹ️ ל־<b>${courseMain.courseName}</b> אין קורסי קדם.</div>`,
        });
      }

      return res.json({
        html: `
          <div class="text-sm leading-6">
            📘 <b class="bot-title">קורסי קדם ל־${courseMain.courseName}</b><br/><br/>
            ${prereqs.map((p) => `• ${p.name}`).join("<br/>")}
          </div>
        `,
      });
    }

    // Bare course name ("חדוא 1") - ask what the user wants to know about it.
    // Checked before lookup because the LLM tends to classify a bare name as lookup.
    if (courseMain && coursesFromQuestion.length === 1 && isBareCourseMention(qNorm, courseMain)) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "course_clarify", wasAnswered: true, detectedCourses: coursesFromQuestion });
      return res.json({
        html: `
          <div class="text-sm">
            🤔 מה תרצה/י לדעת על <b>${courseMain.courseName}</b> (${courseMain.courseCode})?<br/><br/>
            אפשר לשאול למשל:<br/>
            • מה קורסי הקדם של ${courseMain.courseName}?<br/>
            • מתי המעבדה הבאה ב${courseMain.courseName}?<br/>
            • אילו קורסים אפשר לקחת במקביל ל${courseMain.courseName}?
          </div>
        `,
      });
    }

    // Lookup - only on genuine "does course X exist / what is its code" intent.
    // A bare course mention is NOT enough; anything else falls through to the
    // RAG/generative fallback so unknown asks are answered there or logged as unanswered.
    if (courseMain && (kind === "lookup" || isCourseLookupQuestion(question, qNorm))) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "courses", wasAnswered: true, detectedCourses: coursesFromQuestion });
      return res.json({
        html: `<div class="text-sm">✅ <b>${courseMain.courseName}</b> (${courseMain.courseCode})</div>`,
      });
    }

    // Relations (2+)
 if (coursesFromQuestion.length >= 2) {
  logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "courses", wasAnswered: true, detectedCourses: coursesFromQuestion });
  const prerequisites = new Set();
  const parallels = new Set();

  const target = coursesFromQuestion[0];

  for (let i = 0; i < coursesFromQuestion.length; i++) {
    for (let j = i + 1; j < coursesFromQuestion.length; j++) {
      const A = coursesFromQuestion[i];
      const B = coursesFromQuestion[j];

      const prereqsA = await getAllPrerequisitesRecursiveCached(yearbookId, A.courseCode);
      const prereqsB = await getAllPrerequisitesRecursiveCached(yearbookId, B.courseCode);

      if (A.courseCode === target.courseCode &&
          prereqsA.some(p => p.code === B.courseCode)) {
        prerequisites.add(B.courseName);
      }

      if (B.courseCode === target.courseCode &&
          prereqsB.some(p => p.code === A.courseCode)) {
        prerequisites.add(A.courseName);
      }

      // Corequisite — only when a relation record exists in Firestore.
      const relAB = await getRelationType(yearbookId, A.courseCode, B.courseCode);
      const relBA = await getRelationType(yearbookId, B.courseCode, A.courseCode);

      if (relAB === "COREQUISITE" || relBA === "COREQUISITE") {
        parallels.add(`${A.courseName} ו־${B.courseName}`);
      }
    }
  }

  let answer = "";

  // prerequisite block
  if (prerequisites.size) {
    const list = [...prerequisites];

    answer += `⛔ לא ניתן ללמוד את הקורסים יחד.<br/>`;

    if (list.length === 1) {
      answer += `📌 קודם צריך לסיים <b>${list[0]}</b>, ואז לקחת <b>${target.courseName}</b>.<br/>`;
    } else {
      answer += `📌 קודם צריך לסיים:<br/>
${list.map(c => `• ${c}`).join("<br/>")}
<br/>ואז לקחת <b>${target.courseName}</b>.<br/>`;
    }

    return res.json({ html: `<div class="text-sm leading-6">${answer}</div>` });
  }

  // corequisite/parallel reply
  if (parallels.size) {
    answer += `✅ אפשר ללמוד במקביל 🙂<br/>
${[...parallels].map(c => `• ${c}`).join("<br/>")}`;

    return res.json({ html: `<div class="text-sm leading-6">${answer}</div>` });
  }

  // no relation found
  answer += `ℹ️ לא נראה שיש דרישות קדם ביניהם — אפשר ללמוד יחד 😊`;
  return res.json({ html: `<div class="text-sm leading-6">${answer}</div>` });
}


    // 0) Direct contact lookup (e.g. "מי ראש המחלקה") from ניהול-סמסטר contacts.
    //    Deterministic, so it doesn't depend on the generative fallback.
    const contactHits = await findContactsByQuery(question);
    if (contactHits.length) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "contacts", wasAnswered: true });
      return res.json({ html: buildContactsAnswer(contactHits) });
    }

    // 1) Semantic RAG over curated admin answers - no generative call on a hit.
    const ragHit = await ragCuratedAnswer(question, yearbookId);
    if (ragHit) {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "rag_curated", wasAnswered: true });
      return res.json({ html: ragHit.answerHtml });
    }

    // 2) Generative LLM ONLY on a RAG miss - it answers, or routes the case.
    const routed = await answerOrRoute(question, yearbookId, clientSemester, reservesMitve, reservesGroup, historyText);
    if (routed.type === "answer") {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "rag", wasAnswered: true });
      return res.json({ html: routed.html });
    }
    if (routed.type === "offtopic") {
      logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "offtopic", wasAnswered: false });
      return res.json({ html: `<div class="text-sm">אני יכול לעזור רק בנושאים אקדמיים הקשורים לתואר 🙂</div>` });
    }

    // 3) Study-related but unanswered -> direct the (likely lost) student to an advisor.
    logUsageEvent({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null, answerSource: "advisor_redirect", wasAnswered: false });
    autoSaveUnanswered({ question, yearbook: yearbookId, semester: clientSemester || null, topic: clientTopic || null });
    return res.json({ html: buildAdvisorRedirect() });
  } catch (err) {
    console.error("ASK ERROR:", err);
    res.status(500).json({ html: "שגיאה בעיבוד השאלה" });
  }
});

/* =============================
   Route: /courses/suggest
============================= */

router.get("/courses/suggest", async (req, res) => {
  try {
    const { yearbookId, q: qRaw } = req.query;
    if (!yearbookId || !qRaw) return res.json({ suggestions: [] });

    const query = normalizeHebrew(qRaw);
    const courses = await getAllCoursesCached(yearbookId);

    const results = courses
      .map((c) => {
        const name = c.nameNorm || normalizeHebrew(c.courseName);
        const code = c.codeNorm || String(c.courseCode).trim();
        let score = 0;

        if (name === query || code === query) score = 200;
        else if (name.startsWith(query)) score = 150;
        else if (name.includes(query)) score = 100;
        else {
          const queryWords = query.split(" ").filter((w) => w.length >= 2);
          const matched = queryWords.filter((word) => name.includes(word));
          if (matched.length > 0) score = 60 + matched.length * 10;
        }

        return { ...c, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    res.json({ suggestions: results });
  } catch (err) {
    console.error("SUGGEST ERROR:", err);
    res.status(500).json({ error: "failed" });
  }
});

export default router;