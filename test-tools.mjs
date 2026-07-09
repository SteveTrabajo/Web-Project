// Throwaway tester for the /api/ask-tools prototype. Run with the backend up:
//   node test-tools.mjs
// Optional overrides:  node test-tools.mjs <yearbookId> <port>

const YEARBOOK = process.argv[2] || "tashpav";
const PORT = process.argv[3] || "3000";
const BASE = `http://localhost:${PORT}`;

const QUESTIONS = [
  // reverse direction - all three should route to get_courses_requiring
  "אילו קורסים דורשים ביוכימיה?",
  "מה אפשר ללמוד אחרי שסיימתי ביוכימיה?",
  "ביוכימיה פותחת לי אילו קורסים?",
  // forward direction - all should route to get_prerequisites (the disambiguation test)
  "מה קורסי הקדם של ביוכימיה?",
  "מה צריך ללמוד לפני ביוכימיה?",
  // labs - should route to get_lab_schedule (NOT to a prereq tool despite the course name)
  "מתי המעבדה הבאה בביוכימיה?",
  "אילו מעבדות יש ביום ב?",
  "מתי המעבדות של ביוכימיה בסמסטר 4?",
  // two-course relations - should route to get_course_relations (NOT a single-course prereq tool)
  "אפשר ללמוד ביוכימיה וכימיה כללית ואנליטית 2 יחד?",
  "אפשר לקחת ביוכימיה במקביל לגנטיקה?",
  // registration - should route to get_registration_info with the right aspect
  "מתי חלון הרישום לסמסטר 2?",
  "מי היועצים האקדמיים?",
  "כמה נקודות זכות צריך לתואר?",
  // disambiguation: lab CONTACTS (registration) vs lab SCHEDULE (get_lab_schedule)
  "מי אחראי המעבדות בסמסטר 4?",
  // emotional support - should route to emotional_support
  "אני ממש בלחץ ולא מסתדר עם הלימודים",
  // knowledge base - should route to search_knowledge_base (needs curated answers in Firestore)
  "מה מדיניות הנוכחות במעבדות?",
  // no matching tool and nothing in the KB - should decline honestly
  "עד מתי אפשר לבטל קורס?",
];

const stripHtml = (html = "") =>
  String(html)
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function ask(question) {
  const res = await fetch(`${BASE}/api/ask-tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yearbookId: YEARBOOK, question }),
  });
  return res.json();
}

console.log(`\nTesting ${BASE}/api/ask-tools  (yearbook: ${YEARBOOK})\n`);

for (const q of QUESTIONS) {
  try {
    const data = await ask(q);
    const dbg = data._debug || {};
    console.log("──────────────────────────────────────────");
    console.log("Q:    " + q);
    console.log("route:" + ` ${dbg.type || "?"}` + (dbg.tool ? `  →  ${dbg.tool}(${JSON.stringify(dbg.args)})` : ""));
    console.log("A:    " + stripHtml(data.html));
  } catch (e) {
    console.log("──────────────────────────────────────────");
    console.log("Q:    " + q);
    console.log("ERROR: " + e.message + "  (is the server running on port " + PORT + "?)");
  }
}
console.log("──────────────────────────────────────────\n");
