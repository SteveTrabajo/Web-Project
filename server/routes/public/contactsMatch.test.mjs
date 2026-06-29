// Run: node routes/public/contactsMatch.test.mjs
import assert from "node:assert";
import { matchContacts } from "./contactsMatch.js";

const contacts = [
  { name: "לילך יסעור קרוח", role: "ראש המחלקה", email: "iasur@braude.ac.il" },
  { name: "נטלי ופריק", role: "מזכירת המחלקה", email: "nataliav@braude.ac.il" },
  { name: "ליאורה מנדלי", role: 'עוזרת רמ"ח', email: "mendaleyl@braude.ac.il" },
];
const names = (q) => matchContacts(contacts, q).map((c) => c.name);

// exact role phrase
assert.deepStrictEqual(names("מי ראש המחלקה?"), ["לילך יסעור קרוח"]);
assert.deepStrictEqual(names("מי מזכירת המחלקה"), ["נטלי ופריק"]);
// loose: suffix variant מזכירה vs role מזכירת, with definite-article ה
assert.deepStrictEqual(names("מי המזכירה"), ["נטלי ופריק"]);
// loose: ראש מחלקה without the definite article
assert.deepStrictEqual(names("מי ראש מחלקה"), ["לילך יסעור קרוח"]);
// quotes in role are normalized away, so רמ"ח matches רמח
assert.deepStrictEqual(names('מי עוזרת רמ"ח'), ["ליאורה מנדלי"]);
// match by full name too
assert.deepStrictEqual(names("יש לי שאלה ללילך יסעור קרוח"), ["לילך יסעור קרוח"]);
// unrelated question matches nothing
assert.deepStrictEqual(names("מה דרישות הקדם לביוכימיה"), []);
// generic word alone must NOT match (avoids false positives)
assert.deepStrictEqual(names("איפה המחלקה ממוקמת"), []);

console.log("contactsMatch OK");
