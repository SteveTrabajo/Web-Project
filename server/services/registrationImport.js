/*
 * Shaping helpers for the "הנחיות כלליות לרישום" DOCX import.
 * No Firestore dependency, so the accuracy-critical parts stay unit-testable.
 */

// Contact rows carry the semesters they apply to; advisors are split across
// semester buckets in the source table, everyone else is department-wide.
// A row with no semesters applies everywhere.
export function contactsForSemester(contacts = {}, semester) {
  const out = {};
  for (const [key, list] of Object.entries(contacts)) {
    out[key] = (list || [])
      .filter((c) => !c.semesters?.length || c.semesters.includes(semester))
      .map(({ semesters, ...rest }) => rest);
  }
  return out;
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
