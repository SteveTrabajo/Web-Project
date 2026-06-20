/**
 * Known gaps documented in official source files — not parser bugs.
 * Used by knowledge-check to surface as info instead of blocking warnings.
 */

/** How a missing credits value in Firebase maps to the yearbook source. */
export const CREDITS_GAP_KIND = {
  /** DOCX credits column shows "-" — course is not counted toward credit points. */
  NON_CREDIT_COURSE: "nonCreditCourse",
  /** DOCX credits cell has non-numeric text (not "-"). */
  SOURCE_TEXT_NOT_NUMERIC: "sourceTextNotNumeric",
  /** DOCX credits cell is empty. */
  SOURCE_EMPTY: "sourceEmpty",
};

const CREDITS_GAP_MESSAGES = {
  [CREDITS_GAP_KIND.NON_CREDIT_COURSE]:
    "הקורס אינו נספר לנקודות זכות לפי המסמך המקורי",
  [CREDITS_GAP_KIND.SOURCE_TEXT_NOT_NUMERIC]:
    'חסר מספר נ״ז במסמך המקור — מופיע כטקסט לא מספרי ("חובת נוכחות")',
  [CREDITS_GAP_KIND.SOURCE_EMPTY]:
    "חסר מספר נ״ז במסמך המקור — השדה ריק",
};

/**
 * Courses where credits is null in Firebase because of how the yearbook DOCX marks נ"ז.
 * Only `-` means non-credit; empty/text are separate kinds.
 * @type {Record<string, { kind: string, sourceCreditsMark: string }>}
 */
export const KNOWN_CREDITS_GAPS = {
  11063: { kind: CREDITS_GAP_KIND.NON_CREDIT_COURSE, sourceCreditsMark: "-" },
  11064: { kind: CREDITS_GAP_KIND.NON_CREDIT_COURSE, sourceCreditsMark: "-" },
  11179: { kind: CREDITS_GAP_KIND.NON_CREDIT_COURSE, sourceCreditsMark: "-" },
  41452: {
    kind: CREDITS_GAP_KIND.SOURCE_TEXT_NOT_NUMERIC,
    sourceCreditsMark: "חובת נוכחות",
  },
  41454: { kind: CREDITS_GAP_KIND.SOURCE_EMPTY, sourceCreditsMark: "" },
};

/**
 * @returns {{ kind: string, message: string, sourceCreditsMark: string, acceptedKnownGap: true } | null}
 */
export function knownCreditsGapInfo(courseCode) {
  const code = String(courseCode || "").trim();
  const entry = KNOWN_CREDITS_GAPS[code];
  if (!entry) return null;
  return {
    kind: entry.kind,
    message: CREDITS_GAP_MESSAGES[entry.kind],
    sourceCreditsMark: entry.sourceCreditsMark,
    acceptedKnownGap: true,
  };
}

/** @deprecated Use knownCreditsGapInfo — kept for message-only callers. */
export function knownCreditsGapMessage(courseCode) {
  return knownCreditsGapInfo(courseCode)?.message || null;
}

/**
 * Lab rows with staff genuinely absent in the official Excel source.
 * @type {Array<{ semester: string|number, courseCode: string, session?: string, group?: string|number, reason: string }>}
 */
export const KNOWN_MISSING_LAB_STAFF = [
  {
    semester: 6,
    courseCode: "41652",
    session: "אקטיבציה",
    group: "1",
    reason: "חסר staff במקור הרשמי (Excel) עבור רשומת מעבדה אחת",
  },
];

/** Semesters where registration window text exists but was not parsed to date/time. */
export const KNOWN_REGISTRATION_WINDOW_GAP_SEMESTERS = new Set([6, 7, 8]);

/** Semesters where links are absent in the source document (not an import defect). */
export const KNOWN_MISSING_LINKS_SEMESTERS = new Set([2, 8]);

export function isKnownMissingLabStaff({ semester, courseCode, session, group, missingFields }) {
  if (!missingFields?.includes("staff")) return false;
  const sem = String(semester ?? "").trim();
  const code = String(courseCode ?? "").trim();
  const sess = String(session ?? "").trim();
  const grp = String(group ?? "").trim();

  return KNOWN_MISSING_LAB_STAFF.some((known) => {
    if (String(known.semester) !== sem) return false;
    if (known.courseCode !== code) return false;
    if (known.session != null && known.session !== "" && known.session !== sess) return false;
    if (known.group != null && known.group !== "" && String(known.group) !== grp) return false;
    return true;
  });
}

export function knownLabStaffGapMessage(ctx) {
  const match = KNOWN_MISSING_LAB_STAFF.find((known) => {
    const sem = String(ctx.semester ?? "").trim();
    const code = String(ctx.courseCode ?? "").trim();
    const sess = String(ctx.session ?? "").trim();
    const grp = String(ctx.group ?? "").trim();
    if (String(known.semester) !== sem) return false;
    if (known.courseCode !== code) return false;
    if (known.session != null && known.session !== "" && known.session !== sess) return false;
    if (known.group != null && known.group !== "" && String(known.group) !== grp) return false;
    return true;
  });
  return match?.reason || null;
}

export function isKnownRegistrationWindowGap(semesterNumber) {
  return KNOWN_REGISTRATION_WINDOW_GAP_SEMESTERS.has(Number(semesterNumber));
}

export function isKnownMissingLinksGap(semesterNumber) {
  return KNOWN_MISSING_LINKS_SEMESTERS.has(Number(semesterNumber));
}

/**
 * Derive section status from issues (error > warning > ok_with_notes > ok).
 */
export function sectionStatusFromIssues(issues, { hasContent = true, emptyStatus = "warning" } = {}) {
  if (issues.some((i) => i.level === "error")) return "error";
  if (issues.some((i) => i.level === "warning")) return "warning";
  if (issues.some((i) => i.level === "info")) return "ok_with_notes";
  return hasContent ? "ok" : emptyStatus;
}

/**
 * Overall status across sections.
 */
export function worstStatus(...statuses) {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  if (statuses.includes("ok_with_notes")) return "ok_with_notes";
  if (statuses.every((s) => s === "empty")) return "empty";
  if (statuses.includes("empty")) return "warning";
  return "ok";
}
