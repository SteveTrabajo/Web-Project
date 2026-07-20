import fetch from "node-fetch";

/*
 * Regression test for course recognition in the LLM tool router.
 *
 * Course questions (a bare course name, a "what's the course number of X", a
 * "how many credits is X") were falling through to kb_miss / no_tool because the
 * router picks tools from static descriptions with no knowledge of the catalog.
 * The fix detects real courses deterministically, hints the model, and falls back
 * to the course-info card. Each case here pins a known course question to the
 * course tool + course code it must resolve to.
 *
 * NOTE: uses JSON.stringify over fetch so Hebrew is sent as real UTF-8. Do not
 * port this to a shell/curl harness - Git Bash on Windows mangles Hebrew to "?".
 *
 * Usage:  node tests/router.courses.test.js   (server must be running)
 */

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const YB = process.env.TEST_YEARBOOK || "tashpav";

// tool: acceptable tool name(s). code: course code the answer must contain.
const CASES = [
  { q: "מה המספר קורס של כימיה ופורמולציה של תרופות", tool: ["get_course_info"], code: "41632" },
  { q: "כמה נקז זה קורס מעבדה בשיטות הפרדה ודיאגנוסטיקה", tool: ["get_course_info"], code: "41652" },
  { q: "מעבר מסה", tool: ["get_course_info"], code: "41415" },
  { q: "תהליכים חדשניים בפודטק", tool: ["get_course_info"], code: "41671" },
  { q: "הנדסה גנטית", tool: ["get_course_info"], code: "41174" },
  // Regression: these must still reach their own tool, not the course fallback.
  { q: "מה קורסי הקדם של ביוכימיה", tool: ["get_prerequisites"], code: null },
  { q: "מי ראש המחלקה", tool: ["find_contact"], code: null },
  { q: "מתי חלון הרישום", tool: ["get_registration_info"], code: null },
];

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function ask(question) {
  const res = await fetch(`${BASE}/api/ask-tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yearbookId: YB, question }),
  });
  return res.json();
}

async function run() {
  console.log(`== Router course recognition (via ${BASE}, yearbook ${YB}) ==`);
  let passed = 0;
  const failures = [];

  for (const c of CASES) {
    let r;
    try {
      r = await ask(c.q);
    } catch (err) {
      failures.push(c.q);
      console.log(`  FAIL  ${c.q}\n        request error: ${err.message}`);
      continue;
    }
    const tool = r._debug?.tool || null;
    const ans = stripHtml(r.html);
    const toolOk = c.tool.includes(tool);
    const codeOk = !c.code || ans.includes(c.code);

    if (toolOk && codeOk) {
      passed++;
      console.log(`  PASS  ${c.q}  -> ${tool}${c.code ? ` (${c.code})` : ""}`);
    } else {
      failures.push(c.q);
      console.log(`  FAIL  ${c.q}`);
      if (!toolOk) console.log(`        tool: got ${tool || `(none/${r._debug?.type})`}, want one of ${c.tool.join("/")}`);
      if (!codeOk) console.log(`        answer missing course code ${c.code}`);
      console.log(`        ans: ${ans.slice(0, 120)}`);
    }
  }

  console.log(`\n== Summary ==\n  ${passed}/${CASES.length} passed`);
  if (failures.length) process.exit(1);
  console.log("\nAll router course-recognition checks passed.");
}

run().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
