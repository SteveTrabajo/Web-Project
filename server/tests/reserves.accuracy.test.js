import fetch from "node-fetch";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

/*
 * Accuracy test for the reserve-duty (מילואים) answer flow.
 *
 * This flow answers grounded questions for reservist students, so a wrong number
 * is a real harm - the suite pins each answer to a specific, verified line in the
 * source documents under server/files/. Two layers:
 *   1) File integrity (deterministic): every doc the flow depends on exists and is
 *      non-empty. This is the exact bug class that broke the flow before (code
 *      referencing files that had been renamed/deleted).
 *   2) Factual accuracy (integration): real questions hit the running server and
 *      the answer must contain the correct fact - and, for an out-of-scope ask,
 *      must defer instead of inventing one.
 *
 * Usage:  node tests/reserves.accuracy.test.js
 *         TEST_BASE=http://localhost:3000 node tests/reserves.accuracy.test.js
 * Requires the server to be running (npm start / npm run dev).
 */

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, "../files");

// Mirrors the file lists in routes/public/ask.js. Kept here explicitly so the
// test fails loudly if a source file is renamed or removed without the code
// being updated.
const GENERAL_FILES = [
  "miluim_general_info.txt",
  "miluim_rights_regular.txt",
  "miluim_rights_long.txt",
  "miluim_rights_parent.txt",
  "miluim_rights_emergency.txt",
];
const MITVE_FILES = [
  "tashpad_semA.txt",
  "tashpad_semB.txt",
  "tashpah_semA.txt",
  "tashpah_semB.txt",
  "tashpav_semA.txt",
];

// Every case cites the source doc + fact so a failure is traceable to the ground truth.
const CASES = [
  {
    q: "כמה צילומי מסמכים בחינם מגיעים על כל יום היעדרות?",
    all: ["50"],
    src: "miluim_rights_regular.txt - 50 צילומים ליום היעדרות",
  },
  {
    q: "מכמה ימי מילואים אני זכאי לשאול מודם סלולרי (NetStick)?",
    all: ["4"],
    src: "miluim_rights_regular.txt - 4 ימים ומעלה",
  },
  {
    q: "כמה תוספת זמן בבחינות מגיעה למי ששירת 21 ימים במצטבר בסמסטר?",
    any: ["25%", "25 אחוז", "25"],
    src: "miluim_rights_long.txt - תוספת 25% בבחינות",
  },
  {
    q: "כמה נקודות זכות אקדמיות מזכה שירות מילואים ארוך?",
    all: ["2"],
    any: ["נקודות זכות", "פעילות חברתית"],
    src: "miluim_rights_long.txt - 2 נקודות זכות (פעילות חברתית וקהילתית)",
  },
  {
    q: "כמה ימי מילואים במצטבר מזכים בהארכת התואר בשני סמסטרים?",
    all: ["150"],
    src: "miluim_rights_long.txt - 150 ימים -> הארכה ב-2 סמסטרים",
  },
  {
    q: "עד איזו שעה בבוקר סטודנט הורה שבן או בת זוגו במילואים רשאי להיעדר?",
    any: ["10:30", "10.30"],
    src: "miluim_rights_parent.txt - היעדרות עד 10:30",
  },
  {
    q: "כמה ימי היעדרות מקסימום מגיעים לסטודנט הורה כשבן הזוג משרת בצו 8?",
    all: ["5"],
    src: "miluim_rights_parent.txt - עד מקסימום 5 ימי היעדרות",
  },
  {
    q: "כמה ימי שירות רצופים בתקופת הבחינות מזכים במועד מיוחד בנסיבות חירום?",
    all: ["5"],
    src: "miluim_rights_emergency.txt - לפחות 5 ימים רצופים",
  },
  {
    q: "בכמה ימים לפחות נדחית הגשת מטלה בשירות בנסיבות חירום?",
    all: ["10"],
    src: "miluim_rights_emergency.txt - דחייה ב-10 ימים לפחות",
  },
  {
    q: 'מתי צריך להגיש בקשת ולת"ם לפני מועד הגיוס?',
    all: ["30"],
    src: "miluim_general_info.txt - עד 30 ימים לפני הגיוס",
  },
  {
    q: 'תוך כמה ימים אפשר לערער על החלטת ולת"ם?',
    all: ["7"],
    src: "miluim_general_info.txt - ערעור עד 7 ימים",
  },
  {
    q: 'מה מספר הטלפון של ער"ן?',
    all: ["1201"],
    src: "miluim_general_info.txt - ער\"ן 1201",
  },
  {
    q: "מי יועץ המילואים של המחלקה לביוטכנולוגיה?",
    any: ["בוסיס"],
    src: "miluim_general_info.txt - ביוטכנולוגיה: ד\"ר ערן בוסיס",
  },
  // Grounding guard: not covered by any document -> must defer, not invent.
  {
    q: "האם המכללה מעניקה מלגת רכב חדש לסטודנטים במילואים?",
    any: ["רכז המילואים", "דקנט", "לא מופיע", "לא צוין", "לא נמצא", "מומלץ לפנות", "אין"],
    src: "GROUNDING - fact absent from all docs, expect a deferral",
  },
];

// A small mitve doc is used on purpose: the facts under test all live in the
// always-loaded general files, so a small framework doc keeps per-request token
// usage low and avoids tripping the OpenAI tokens-per-minute limit mid-suite.
const MITVE = "mitve_tashpah_sem_a"; // -> tashpad_semA.txt (~8k chars)
const GROUP = "group_1";

// Spacing between requests, to stay well under the OpenAI TPM burst limit.
const REQUEST_GAP_MS = 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function ask(question) {
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      yearbookId: "test",
      topic: "reserves",
      reservesMitve: MITVE,
      reservesGroup: GROUP,
      question,
    }),
  });
  const data = await res.json();
  return stripHtml(data?.html);
}

function checkFiles() {
  console.log("== File integrity ==");
  let ok = true;
  for (const f of [...GENERAL_FILES, ...MITVE_FILES]) {
    const p = path.join(FILES_DIR, f);
    const exists = existsSync(p);
    const size = exists ? readFileSync(p, "utf8").trim().length : 0;
    const pass = exists && size > 50;
    if (!pass) ok = false;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${f}${exists ? ` (${size} chars)` : " (MISSING)"}`);
  }
  return ok;
}

async function run() {
  const filesOk = checkFiles();

  console.log("\n== Factual accuracy (via " + BASE + ") ==");
  let passed = 0;
  const failures = [];

  for (const c of CASES) {
    await sleep(REQUEST_GAP_MS);
    let answer;
    try {
      answer = await ask(c.q);
    } catch (err) {
      failures.push({ c, answer: `(request failed: ${err.message})`, missing: c.all || c.any });
      console.log(`  FAIL  ${c.q}\n        error: ${err.message}`);
      continue;
    }

    const missingAll = (c.all || []).filter((t) => !answer.includes(t));
    const anyHit = !c.any || c.any.some((t) => answer.includes(t));
    const noneHit = (c.none || []).filter((t) => answer.includes(t));
    const pass = missingAll.length === 0 && anyHit && noneHit.length === 0;

    if (pass) {
      passed++;
      console.log(`  PASS  ${c.q}`);
    } else {
      failures.push({
        c,
        answer,
        missing: [...missingAll, ...(anyHit ? [] : [`one of: ${(c.any || []).join(" / ")}`])],
        forbidden: noneHit,
      });
      console.log(`  FAIL  ${c.q}`);
      console.log(`        source : ${c.src}`);
      if (missingAll.length) console.log(`        missing: ${missingAll.join(", ")}`);
      if (!anyHit) console.log(`        missing any-of: ${(c.any || []).join(" / ")}`);
      if (noneHit.length) console.log(`        forbidden present: ${noneHit.join(", ")}`);
      console.log(`        answer : ${answer.slice(0, 300)}`);
    }
  }

  console.log(`\n== Summary ==`);
  console.log(`  Files:    ${filesOk ? "OK" : "FAILED"}`);
  console.log(`  Accuracy: ${passed}/${CASES.length} passed`);

  if (!filesOk || failures.length) {
    console.log(`\n${failures.length} accuracy failure(s).`);
    process.exit(1);
  }
  console.log("\nAll reserve-duty checks passed.");
}

run().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
