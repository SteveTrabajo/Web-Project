import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import os from "os";
import path from "path";
import { buildGuidelinesPatch } from "../services/registrationImport.js";

/*
 * Regression test for registration_guidelines_parser.py.
 *
 * The guidelines document drives concrete answers (credit caps, advisor routing
 * by surname letter, effective dates), so a silent parse regression would make
 * the bot confidently wrong. Every assertion below is pinned to a specific line
 * or table cell in server/files/הנחיות כלליות לרישום.docx.
 *
 * Runs the parser directly - no server and no network needed.
 *
 * Usage: node tests/registration.parser.test.js
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..");
const DOC = path.resolve(SERVER_DIR, "files/הנחיות כלליות לרישום.docx");
const PYTHON_CMD = os.platform() === "win32" ? "py" : "python3";

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push({ label, actual: a, expected: e });
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${e}`);
    console.log(`        actual  : ${a}`);
  }
}

function checkTruthy(label, value) {
  if (value) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push({ label, actual: String(value), expected: "truthy" });
    console.log(`  FAIL  ${label}`);
  }
}

function run() {
  console.log("\n== Source document ==");
  if (!existsSync(DOC)) {
    console.log(`  FAIL  missing source document: ${DOC}`);
    process.exit(1);
  }
  console.log("  PASS  הנחיות כלליות לרישום.docx present");

  const stdout = execFileSync(
    PYTHON_CMD,
    ["parsers/registration_guidelines_parser.py", DOC],
    { cwd: SERVER_DIR, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  );
  const lines = stdout.trim().split(/\r?\n/);
  const out = JSON.parse(lines[lines.length - 1]);

  console.log("\n== Document metadata ==");
  check("term is semester A", out.meta.term, "A");
  checkTruthy("year detected", /תשפ/.test(out.meta.year));

  console.log("\n== Credit limits (source: 'נקודות הזכות המקסימליות בסמסטר הן 24 נ\"ז והמינימליות הן 16 נ\"ז') ==");
  check("semester max credits", out.audience.creditsRange?.max, 24);
  check("semester min credits", out.audience.creditsRange?.min, 16);
  check("degree total credits", out.audience.degreeCredits, 165);

  console.log("\n== Key rules ==");
  checkTruthy("rules extracted", (out.keyRules || []).length >= 12);
  const ruleText = (out.keyRules || []).map((r) => r.text).join(" ");
  checkTruthy("exam-clash rule present", ruleText.includes("חפיפה"));
  checkTruthy("repeat-students group rule present", ruleText.includes("מיועד לחוזרים"));
  checkTruthy("blocked-registration tip present", ruleText.includes("רענון תוכנית לימודים"));
  checkTruthy(
    "section headers dropped",
    !(out.keyRules || []).some((r) => /^(מידע כללי|שימו לב|יועצי המחלקה)\s*[-:]?$/.test(r.text.trim()))
  );

  console.log("\n== Advisor table routing ==");
  const advisors = out.contacts.academicAdvisors || [];
  check("advisor rows", advisors.length, 6);

  const bosis = advisors.find((a) => a.name.includes("בוסיס"));
  checkTruthy("בוסיס parsed", !!bosis);
  check("בוסיס semesters", bosis?.semesters, [1, 2]);
  check("בוסיס surname range", [bosis?.assignment.lastNameFrom, bosis?.assignment.lastNameTo], ["א", "כ"]);
  check("בוסיס credits range", bosis?.creditsRange, { min: 0, max: 12.99 });
  check("בוסיס email", bosis?.email, "bosis@braude.ac.il");

  const sammar = advisors.find((a) => a.name.includes("מרעי"));
  check("מרעי surname range", [sammar?.assignment.lastNameFrom, sammar?.assignment.lastNameTo], ["ל", "ת"]);
  check("מרעי effective date retained", sammar?.effectiveFrom, "30.3.26");

  const golani = advisors.find((a) => a.name.includes("גולני"));
  check("גולני name cleaned of separators", golani?.name, "דר' גולני עידית");
  check("גולני semesters", golani?.semesters, [3, 4]);
  check("גולני credits range", golani?.creditsRange, { min: 13, max: 47.99 });

  const weitz = advisors.find((a) => a.name.includes("ויץ"));
  check("track name matches Bot.jsx TRACKS", weitz?.assignment.track, "מולקולרית-תרופתית");
  check("track advisor covers upper semesters", weitz?.semesters, [5, 6, 7, 8]);

  const sabbah = advisors.find((a) => a.name.includes("סבאח"));
  check("food/environment track mapped", sabbah?.assignment.track, "מזון והסביבה");

  console.log("\n== Contact categorisation ==");
  check("exemptions contact", out.contacts.exemptions?.[0]?.name, "דר' פסקוביץ דפנה");
  check("labs contact", out.contacts.labs?.[0]?.name, "גב' גולן עינב");
  check("registration support contact", out.contacts.registrationSupport?.[0]?.name, "גב' ליאורה מינדלי");
  check("mentor row kept despite empty name", out.contacts.mentors?.length, 1);

  console.log("\n== Data-gap warnings ==");
  const warnings = (out.warnings || []).join(" ");
  checkTruthy("missing mentor name flagged", warnings.includes("הסטודנטית המלווה"));
  checkTruthy("missing advisor email flagged", warnings.includes("ויץ"));

  console.log("\n== Per-semester patch (what each semester doc receives) ==");
  const names = (p, key) => (p.contacts[key] || []).map((c) => c.name);

  const sem1 = buildGuidelinesPatch(out, 1).patch;
  check("semester 1 advisors", names(sem1, "academicAdvisors"), ["דר' בוסיס ערן", "פרופ' מרעי סמאר"]);
  check("semester 1 keeps department-wide labs contact", names(sem1, "labs"), ["גב' גולן עינב"]);
  check("semester 1 credit cap", sem1.audience.creditsRange, { min: 16, max: 24 });
  checkTruthy("semester filter strips the semesters field", sem1.contacts.academicAdvisors.every((a) => a.semesters === undefined));

  const sem3 = buildGuidelinesPatch(out, 3).patch;
  check("semester 3 advisors", names(sem3, "academicAdvisors"), ["דר' גולני עידית", "דר' אלפסי גלעד"]);

  const sem6 = buildGuidelinesPatch(out, 6).patch;
  check("semester 6 advisors are the track advisors", names(sem6, "academicAdvisors"), ["דר' ויץ איריס", "פרופ' סבאח עיסאם"]);

  const sem2 = buildGuidelinesPatch(out, 2);
  checkTruthy("no spurious 'no advisor' warning when advisors match", !sem2.warnings.some((w) => w.includes("לא נמצא יועץ")));

  const noAdvisors = buildGuidelinesPatch({ ...out, contacts: { ...out.contacts, academicAdvisors: [] } }, 1);
  checkTruthy("warns when no advisor matches the semester", noAdvisors.warnings.some((w) => w.includes("לא נמצא יועץ")));

  console.log(`\n== Summary ==`);
  console.log(`  ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(`\n${failures.length} parser regression(s).`);
    process.exit(1);
  }
  console.log("\nAll registration guidelines parser checks passed.");
}

try {
  run();
} catch (err) {
  console.error("Test runner crashed:", err.message);
  process.exit(1);
}
