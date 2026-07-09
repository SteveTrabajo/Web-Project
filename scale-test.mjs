// Phase B scale test for the tool router. Runs a batch of questions through
// /api/ask-tools and reports routing accuracy + distribution.
//
//   node scale-test.mjs [questionsFile] [yearbookId] [port]
//
// Question file format (one per line; blank lines and # comments ignored):
//   <question>                      - routing recorded, not graded
//   <question> | <expected_tool>    - graded against the expected tool
// expected_tool is a tool name (e.g. get_lab_schedule) or "no_tool".
// Defaults: scale-questions.txt, tashpav, 3000.

import { readFile } from "node:fs/promises";

const FILE = process.argv[2] || "scale-questions.txt";
const YEARBOOK = process.argv[3] || "tashpav";
const PORT = process.argv[4] || "3000";
const BASE = `http://localhost:${PORT}`;

const raw = await readFile(FILE, "utf8").catch(() => {
  console.error(`Cannot read ${FILE}. Create it (one question per line) or pass a path.`);
  process.exit(1);
});

const items = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [q, expected] = l.split("|").map((s) => s.trim());
    return { q, expected: expected || null };
  });

async function route(question) {
  try {
    const res = await fetch(`${BASE}/api/ask-tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearbookId: YEARBOOK, question }),
    });
    const data = await res.json();
    const dbg = data._debug || {};
    return dbg.type === "tool" ? dbg.tool : dbg.type || "?";
  } catch (e) {
    return `ERROR:${e.message}`;
  }
}

const labeledCount = items.filter((i) => i.expected).length;
console.log(`\nScale test: ${BASE}/api/ask-tools  (yearbook: ${YEARBOOK})`);
console.log(`Loaded ${items.length} questions (${labeledCount} labeled)\n`);

const dist = {};
const misroutes = [];
let correct = 0;
let errors = 0;

for (const { q, expected } of items) {
  const got = await route(q);
  dist[got] = (dist[got] || 0) + 1;
  if (got.startsWith("ERROR:")) errors++;

  let mark = "    ";
  if (expected) {
    if (got === expected) {
      correct++;
      mark = "PASS";
    } else {
      mark = "FAIL";
      misroutes.push({ q, got, expected });
    }
  }
  console.log(`${mark}  ${got.padEnd(24)} ${q}`);
}

console.log("\nSummary");
if (labeledCount) {
  const pct = ((correct / labeledCount) * 100).toFixed(1);
  console.log(`  accuracy: ${correct}/${labeledCount} (${pct}%) on labeled questions`);
}
console.log(`  total: ${items.length}   errors: ${errors}`);
console.log("  routing distribution:");
for (const [tool, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${tool.padEnd(24)} ${n}`);
}
if (misroutes.length) {
  console.log("  misroutes:");
  for (const m of misroutes) console.log(`    "${m.q}"\n      got ${m.got}, expected ${m.expected}`);
}
console.log("");
