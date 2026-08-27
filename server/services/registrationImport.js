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

// Parser output -> a patch shaped like a registrationGuidelines/semester_N doc,
// so the admin editor can merge it field by field. registrationWindow is
// deliberately absent: the source document carries no window dates.
export function buildGuidelinesPatch(parsed = {}, semester) {
  const contacts = contactsForSemester(parsed.contacts, semester);
  const warnings = [...(parsed.warnings || [])];
  if (!contacts.academicAdvisors?.length) {
    warnings.push(`לא נמצא יועץ אקדמי המשויך לסמסטר ${semester} בטבלה שבקובץ.`);
  }

  return {
    warnings,
    patch: {
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
    },
  };
}
