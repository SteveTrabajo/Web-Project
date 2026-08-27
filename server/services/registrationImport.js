/*
 * Shaping helpers for the "הנחיות כלליות לרישום" DOCX import.
 * No Firestore dependency, so the accuracy-critical parts stay unit-testable.
 */

// Contact rows carry the semesters they apply to; advisors are split across
// semester buckets in the source table, everyone else is department-wide.
// A row with no semesters applies everywhere.
//
// `semesters` is kept on the stored entry rather than dropped: an advisor covers
// a range (1+2, 3+4) and the sync to the academicAdvisors collection needs that
// full range, not just whichever semester doc it was imported through.
export function contactsForSemester(contacts = {}, semester) {
  const out = {};
  for (const [key, list] of Object.entries(contacts)) {
    out[key] = (list || []).filter(
      (c) => !c.semesters?.length || c.semesters.includes(semester)
    );
  }
  return out;
}

/* =============================
   Advisor sync: registrationGuidelines doc -> academicAdvisors collection

   The two stores hold the same people in different shapes. The registration doc
   keeps `assignment: {lastNameFrom, lastNameTo, track}`; the collection that the
   bot's letter/track picker reads (routes/public/advisor.js) keeps
   `lastNameRanges: ["א-כ"]`, `semesters: [...]`, `tracks: [...]`.
============================= */

// Mirrors AdvisorsTab.jsx - tracks only apply from semester 5 onward.
export const GENERAL_TRACK = "כללי";
const TRACK_FROM_SEMESTER = 5;

const normName = (s = "") => String(s).replace(/["'׳״]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Stable, readable doc id: the email local part, else a slug of the name.
function advisorId(a) {
  const email = String(a.email || "").trim();
  if (email.includes("@")) return email.split("@")[0].toLowerCase();
  return normName(a.name).replace(/\s+/g, "-") || "advisor";
}

// One registrationGuidelines advisor entry -> an academicAdvisors document.
export function toCollectionAdvisor(a = {}) {
  const from = a.assignment?.lastNameFrom || "";
  const to = a.assignment?.lastNameTo || "";
  const track = a.assignment?.track || "";
  const semesters = [...(a.semesters || [])].sort((x, y) => x - y);
  const needsTrack = semesters.some((n) => n >= TRACK_FROM_SEMESTER);

  return {
    id: advisorId(a),
    name: a.name || "",
    email: a.email || "",
    // An advisor with no stated bucket covers everyone, matching the tab's default.
    lastNameRanges: from && to ? [`${from}-${to}`] : ["א-ת"],
    semesters,
    tracks: needsTrack && track ? [track] : [GENERAL_TRACK],
    effectiveFrom: a.effectiveFrom || "",
  };
}

const sameList = (a = [], b = []) => JSON.stringify(a) === JSON.stringify(b);

const FIELD_LABELS = {
  name: "שם",
  email: "מייל",
  lastNameRanges: "טווח אותיות",
  semesters: "סמסטרים",
  tracks: "מסלולים",
  effectiveFrom: "בתוקף מתאריך",
};

/*
 * Diff the doc's advisors against the collection. Returns one row per incoming
 * advisor with status new | update | same, so the admin approves before anything
 * is written. Never proposes deletions: advisors created by hand in the tab and
 * absent from the document are left untouched.
 */
export function diffAdvisorSync(incoming = [], existing = []) {
  const byEmail = new Map();
  const byName = new Map();
  for (const e of existing) {
    const email = String(e.email || "").trim().toLowerCase();
    if (email) byEmail.set(email, e);
    if (e.name) byName.set(normName(e.name), e);
  }

  const rows = [];
  for (const raw of incoming) {
    if (!raw?.name) continue; // e.g. the not-yet-assigned שנה א' mentor slot
    const next = toCollectionAdvisor(raw);
    const email = String(next.email || "").toLowerCase();
    const match = (email && byEmail.get(email)) || byName.get(normName(next.name)) || null;

    if (!match) {
      rows.push({ status: "new", id: next.id, advisor: next, changes: [] });
      continue;
    }

    // Keep the existing document id so a match updates in place instead of
    // creating a duplicate under a differently derived id.
    const merged = { ...next, id: match.id || next.id };
    const changes = [];
    for (const field of Object.keys(FIELD_LABELS)) {
      const before = match[field] ?? (Array.isArray(merged[field]) ? [] : "");
      const after = merged[field];
      const differs = Array.isArray(after) ? !sameList(before, after) : String(before) !== String(after);
      // An email the document does not carry must not blank out a known one.
      if (differs && !(after === "" && before)) {
        changes.push({ field, label: FIELD_LABELS[field], from: before, to: after });
      } else if (after === "" && before) {
        merged[field] = before;
      }
    }
    rows.push({ status: changes.length ? "update" : "same", id: merged.id, advisor: merged, changes });
  }
  return rows;
}

/* =============================
   Destination map

   Answers "where did each part of my document go?" for the import screen.
   Every row names what was found, where it lands, and whether it is imported at
   all - a registration file can also carry course tables, which belong to the
   yearbook importer and are deliberately skipped here.
============================= */

const CONTACT_LABELS = {
  academicAdvisors: "יועצים אקדמיים",
  registrationSupport: "תמיכה ומזכירות",
  mentors: "מלווים (מנטורים)",
  exemptions: "חריגים ופטורים",
  labs: "מעבדות",
};

export function buildDestinationMap(parsed = {}, patch = {}, semester) {
  const doc = `registrationGuidelines/semester_${semester}`;
  const rows = [];

  const add = (row) => rows.push({ status: "import", ...row });

  if (patch.keyRules?.length) {
    add({
      label: "כללים חשובים",
      count: patch.keyRules.length,
      view: "כללים וקישורים",
      store: `${doc}.keyRules`,
    });
  }

  if (patch.audience?.creditsRange) {
    const { min, max } = patch.audience.creditsRange;
    add({
      label: "מגבלות נ\"ז בסמסטר",
      detail: [min != null ? `מינימום ${min}` : "", max != null ? `מקסימום ${max}` : ""].filter(Boolean).join(" · "),
      count: 1,
      view: "מידע כללי",
      store: `${doc}.audience.creditsRange`,
    });
  }

  if (patch.audience?.creditsRuleText) {
    add({ label: "הנחיות נ\"ז (טקסט)", count: 1, view: "מידע כללי", store: `${doc}.audience.creditsRuleText` });
  }

  if (patch.title) {
    add({ label: "כותרת ההנחיות", detail: patch.title, count: 1, view: "מידע כללי", store: `${doc}.title` });
  }

  if (patch.links?.length) {
    add({ label: "קישורים", count: patch.links.length, view: "כללים וקישורים", store: `${doc}.links` });
  }

  for (const [key, label] of Object.entries(CONTACT_LABELS)) {
    const list = patch.contacts?.[key] || [];
    if (!list.length) continue;
    const named = list.filter((c) => c.name);
    add({
      label,
      count: list.length,
      detail: named.map((c) => c.name).join(", ") || "רשומה ללא שם",
      view: "אנשי קשר",
      store: `${doc}.contacts.${key}`,
      // Advisors also drive the bot's letter/track picker, which reads a
      // different collection - that copy needs an explicit sync.
      alsoNeedsSync: key === "academicAdvisors",
    });
  }

  // Tables the parser recognised but does not own.
  for (const t of parsed.tables || []) {
    if (t.kind === "advisors") continue;
    rows.push({
      status: "skip",
      label: t.kind === "courses" ? "טבלת קורסים" : "טבלה לא מזוהה",
      count: t.rows,
      detail: t.header,
      view: "-",
      store: t.kind === "courses" ? "מנוהל דרך העלאת שנתון" : "לא מיובא",
    });
  }

  return rows;
}

// Parser output -> a patch shaped like a registrationGuidelines/semester_N doc,
// so the admin editor can merge it field by field. registrationWindow is
// deliberately absent: the source document carries no window dates.
export function buildGuidelinesPatch(parsed = {}, semester) {
  const contacts = contactsForSemester(parsed.contacts, semester);
  const warnings = [...(parsed.warnings || [])];
  if (!contacts.academicAdvisors?.length) {
    warnings.push(`לא נמצא יועץ אקדמי המשויך לסמסטר ${semester} בטבלה שבקובץ.`);
  }

  const patch = {
    title: parsed.meta?.title || "",
    term: parsed.meta?.term || "",
    audience: {
      cohortText: parsed.audience?.cohortText || "",
      creditsRuleText: parsed.audience?.creditsRuleText || null,
      creditsRange: parsed.audience?.creditsRange || null,
    },
    keyRules: parsed.keyRules || [],
    links: parsed.links || [],
    contacts,
  };

  return { warnings, patch, destinations: buildDestinationMap(parsed, patch, semester) };
}
