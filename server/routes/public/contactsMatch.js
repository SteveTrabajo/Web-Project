// Pure contact-matching helper (no Firestore), kept separate so it stays
// unit-testable without booting the server.

const norm = (s = "") =>
  String(s)
    .replace(/["׳״'`]/g, "")                       // delete quotes/geresh so רמ"ח -> רמח
    .replace(/[^֐-׿0-9A-Za-z\s]/g, " ")  // other punctuation -> space
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

// Words too common to identify a contact on their own (generic nouns +
// question filler). Compared after the definite-article strip below.
const GENERIC = new Set([
  "מחלקה", "צוות", "שאלה",
  "מי", "מה", "את", "של", "עם", "לי", "יש", "צריך", "רוצה", "איפה",
  "למי", "פונה", "פונים", "אפשר", "כדי", "הוא", "היא",
]);

// Strip a leading definite-article "ה" on longer words so המזכירה ≈ מזכירה.
const stripDef = (w) => (w.length >= 4 && w.startsWith("ה") ? w.slice(1) : w);

function tokens(s) {
  return norm(s)
    .split(" ")
    .map(stripDef)
    .filter((w) => w && !GENERIC.has(w));
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Two words match if they're the same short word, or share a 4+ char prefix.
// The prefix rule tolerates Hebrew gender/number suffixes (מזכירה/מזכירת/מזכירות,
// עוזר/עוזרת) without pulling in unrelated words.
function wordMatch(a, b) {
  if (a.length <= 3 || b.length <= 3) return a === b;
  return commonPrefixLen(a, b) >= 4;
}

// Contacts where any significant word of the role or name appears (loosely) in
// the question. Looser than exact-phrase so students can ask naturally
// ("מי המזכירה" still finds the role "מזכירת המחלקה").
export function matchContacts(contacts, question) {
  const qWords = tokens(question);
  if (!qWords.length) return [];
  return contacts.filter((c) => {
    const cWords = [...tokens(c.role), ...tokens(c.name)];
    return cWords.some((cw) => qWords.some((qw) => wordMatch(cw, qw)));
  });
}
