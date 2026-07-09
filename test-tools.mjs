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
  // no matching tool - should decline honestly
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
