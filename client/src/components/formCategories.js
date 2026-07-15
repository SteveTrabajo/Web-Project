// Student-file topic categories. Stable keys match the backend's ALLOWED_CATEGORY
// (formsAdmin.js); Hebrew labels live here so the admin UI and the bot share them.

export const FORM_CATEGORIES = [
  { value: "advisor", label: "ייעוץ אקדמי" },
  { value: "registration", label: "רישום וביטול קורסים" },
  { value: "reserves", label: "מילואים" },
  { value: "leave", label: "חופשה והפסקת לימודים" },
  { value: "exemptions", label: "פטורים והכרות" },
  { value: "extension", label: 'הארכת לימודים ומכסת נ"ז' },
  { value: "appeals", label: "ערעורים" },
  { value: "graduation", label: "סיום תואר" },
  { value: "general", label: "כללי" },
];

const LABELS = new Map(FORM_CATEGORIES.map((c) => [c.value, c.label]));

export const categoryLabel = (value) => LABELS.get(value) || "כללי";

// Groups files into the canonical category order, dropping empty groups.
// Returns [{ value, label, items }].
export function groupByCategory(files = []) {
  const byCat = new Map();
  for (const f of files) {
    const key = LABELS.has(f.category) ? f.category : "general";
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(f);
  }
  return FORM_CATEGORIES.filter((c) => byCat.has(c.value)).map((c) => ({
    value: c.value,
    label: c.label,
    items: byCat.get(c.value),
  }));
}
