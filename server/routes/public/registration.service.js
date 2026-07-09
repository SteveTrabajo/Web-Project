import { db } from "../../server.js";
import { callLLMJson } from "../../services/llm.js";
import { matchContacts } from "./contactsMatch.js";

/* =============================
   Utils
============================= */
export const normalizeHebrew = (s = "") =>
  String(s)
    .replace(/["׳״'`]/g, "")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ייע/g, "יע")
    .replace(/יי/g, "י")
    .toLowerCase()
    .trim();

/* =============================
   Detection
============================= */
export function isRegistrationQuestion(question = "") {
  const q = normalizeHebrew(question);
  return [
    "רישום","הרשמה","חלון","מתי",
    "יועץ","יועצת","יעוץ","ייעוץ",
    "פטור","חריג","נז","165",
    "קישור","הדרכה",
    "למי פונים",
    "מעבדה","מעבדות",
    "מנטור","מלווה",
    "סטודנטים חדשים",
    "סטאז","סטאז׳","התמחות"
  ].some(w => q.includes(w));
}

export function extractSemesterNumber(question = "") {
  const s = String(question);
  let m = s.match(/סמסטר\s*([1-8])/);
  if (m) return Number(m[1]);
  m = s.match(/סמ\s*([1-8])/);
  if (m) return Number(m[1]);
  return null;
}

/* =============================
   LLM – intent
============================= */
export async function classifyRegistrationIntent(question) {
  const prompt = `
את מערכת שמסווגת שאלות על הנחיות רישום אקדמי.

החזירי JSON בלבד בפורמט:
{
  "intent": "window" | "advisors" | "labs" | "links" | "credits"
          | "exemptions" | "contacts" | "mentors"
          | "internship" | "rules" | "general"
}

דוגמאות:

שאלה: "מי היועצים שלי"
תשובה: { "intent": "advisors" }

שאלה: "מי היועצים בסמסטר 2"
תשובה: { "intent": "advisors" }

שאלה: "מי אחראי על מעבדות"
תשובה: { "intent": "labs" }

שאלה: "יש קישור להדרכת רישום?"
תשובה: { "intent": "links" }

שאלה: "כמה נ״ז צריך לתואר?"
תשובה: { "intent": "credits" }

שאלה: "מתי חלון הרישום?"
תשובה: { "intent": "window" }

שאלה:
"${question}"
`;

  return callLLMJson(prompt);
}

/* =============================
   Intent refinement
============================= */
export function refineRegistrationIntent(intent, question) {
  const q = normalizeHebrew(question);

  if (
    q.includes("סטודנט חדש") ||
    q.includes("סטודנטים חדשים") ||
    q.includes("מלווה")
  ) return "mentors";

  if (q.includes("סטאז")) return "internship";
  if (q.includes("מעבדה")) return "labs";
  if (q.match(/יועצ/)||q.includes("יועצים")) return "advisors";
  if (q.includes("פטור") || q.includes("חריג")) return "exemptions";
  if (q.includes("קישור") || q.includes("הדרכה")) return "links";
  if (q.includes("נז") || q.includes("165")) return "credits";
  if (q.includes("מתי") || q.includes("חלון")) return "window";
  if (q.includes("למי פונים") || q.includes("בעיה")) return "contacts";

  return intent || "general";
}

/* =============================
   Firestore
============================= */
export async function getRegDoc(semester) {
  const snap = await db
    .collection("registrationGuidelines")
    .doc(`semester_${semester}`)
    .get();
  return snap.exists ? snap.data() : null;
}

export async function getAllRegDocs() {
  const snap = await db.collection("registrationGuidelines").get();
  return snap.docs
    .map(d => d.data())
    .sort((a, b) => a.semesterNumber - b.semesterNumber);
}

/* =============================
   Registration window formatting
============================= */
// Renders only the parts that exist so empty from/to never produce "בין ל-".
export function formatRegistrationWindow(w) {
  if (!w) return "טרם פורסם";
  const range = w.from && w.to ? `בין ${w.from} ל-${w.to}` : "";
  const out = [w.date, range].filter(Boolean).join(" ");
  return out || "טרם פורסם";
}

/* =============================
   Forms helper
============================= */
function appendForms(forms, intent) {
  if (!forms.length) return "";
  let relevant = [];
  if (intent === "exemptions") {
    relevant = forms.filter((f) => f.label.includes("פטור"));
  } else if (intent === "exception_registration" || intent === "contacts" || intent === "rules") {
    relevant = forms.filter((f) => f.usage === "exception_registration");
  } else if (intent === "advisors") {
    relevant = forms.filter((f) => f.usage === "advisor");
  } else if (intent === "general") {
    relevant = forms;
  }
  if (!relevant.length) return "";
  return `
    <div class="mt-3 pt-2 border-t border-gray-200">
      <b class="bot-subtitle">טפסים רלוונטיים:</b><br/>
      ${relevant.map((f) => `• <a href="${f.url}" target="_blank" rel="noopener noreferrer">${f.label}</a>`).join("<br/>")}
    </div>`;
}

/* =============================
   Live advisor lookup (Firestore)
============================= */
async function getAdvisorsForSemester(semesterNum) {
  try {
    const snap = await db
      .collection("academicAdvisors")
      .where("semesters", "array-contains", Number(semesterNum))
      .get();
    if (snap.empty) return null;
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return null;
  }
}

/* =============================
   RAG context export
============================= */
export async function getRegistrationSummary(semesterNum) {
  try {
    const doc = await getRegDoc(semesterNum);
    if (!doc) return "";
    const w = doc.registrationWindow;
    const windowStr = w ? `חלון רישום: ${w.date} בין ${w.from} ל-${w.to}` : "";
    const rules = (doc.keyRules || []).slice(0, 5).map((r) => r.text).join("; ");
    return [`הנחיות רישום - סמסטר ${semesterNum}:`, windowStr, rules ? `כללים: ${rules}` : ""]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

const CONTACT_CATEGORIES = {
  registrationSupport: "תמיכה ומזכירות",
  academicAdvisors: "יועץ אקדמי",
  mentors: "סטודנט מלווה",
  exemptions: "פטורים/חריגים",
  labs: "אחראי מעבדות",
};

// Flat, deduped list of every contact across all semester docs. Department-wide
// roles (e.g. ראש המחלקה) repeat across semester docs, so dedup by
// name+email+role collapses them to one entry.
export async function getAllContacts() {
  const docs = await getAllRegDocs();
  const seen = new Set();
  const out = [];
  for (const d of docs) {
    const c = d.contacts || {};
    for (const [key, label] of Object.entries(CONTACT_CATEGORIES)) {
      for (const p of c[key] || []) {
        if (!p?.name) continue;
        const dedupeKey = `${p.name}|${p.email || ""}|${p.role || ""}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        out.push({
          name: p.name,
          role: p.role || "",
          email: p.email || "",
          phone: p.phone || "",
          category: label,
        });
      }
    }
  }
  return out;
}

// Plain-text contacts block for the RAG context.
export async function getContactsSummary() {
  try {
    const contacts = await getAllContacts();
    if (!contacts.length) return "";
    const lines = contacts.map((c) => {
      const role = c.role ? ` (${c.role})` : "";
      const email = c.email ? `, מייל: ${c.email}` : "";
      const phone = c.phone ? `, טלפון: ${c.phone}` : "";
      return `${c.category}: ${c.name}${role}${email}${phone}`;
    });
    return `אנשי קשר במחלקה:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// Deterministic lookup for "who is X" contact questions (e.g. "מי ראש המחלקה"),
// so the answer doesn't depend on the generative fallback surfacing it.
export async function findContactsByQuery(question) {
  try {
    return matchContacts(await getAllContacts(), question);
  } catch {
    return [];
  }
}

/* =============================
   Builders – single semester
============================= */
export async function buildRegistrationAnswer(intent, doc, { forms = [] } = {}) {
  const sem = doc.semesterNumber;
  const cohort = doc.audience?.cohortText
    ? ` (${doc.audience.cohortText})`
    : "";

  /* ---------- LINKS ---------- */
  if (intent === "links") {
    const links = doc.links || [];
    if (links.length) {
      return `
        <div class="text-sm">
          <b class="bot-title">הדרכות רישום – סמסטר ${sem}${cohort}</b><br/><br/>
          ${links.map(l =>
            `• <a href="${l.url}" target="_blank">${l.label}</a>`
          ).join("<br/>")}
        </div>`;
    }

    const rules = (doc.keyRules || [])
      .filter(r => r.text.includes("רישום") || r.text.includes("דמו"))
      .map(r => `• ${r.text}`)
      .join("<br/>");

    return `
      <div class="text-sm">
        <b class="bot-title">הנחיות רישום – סמסטר ${sem}</b><br/><br/>
        ${rules || "הרישום מתבצע דרך אתר המכללה."}
      </div>`;
  }

  /* ---------- WINDOW ---------- */
  if (intent === "window") {
    const w = doc.registrationWindow;
    return `
      <div class="text-sm">
        ⏰ <b class="bot-title">חלון הרישום – סמסטר ${sem}${cohort}</b><br/>
        ${formatRegistrationWindow(w)}
      </div>`;
  }

  /* ---------- ADVISORS ---------- */
  if (intent === "advisors") {
    const liveAdvisors = await getAdvisorsForSemester(sem);
    const a = liveAdvisors?.length ? liveAdvisors : (doc.contacts?.academicAdvisors || []);
    const formsHtml = appendForms(forms, intent);
    return `
      <div class="text-sm">
        <b class="bot-title">יועצים אקדמיים - סמסטר ${sem}</b><br/><br/>

        ${a.map((x) => `• ${x.name} - <a href="mailto:${x.email}">${x.email}</a>`).join("<br/>")}

        <hr style="margin:12px 0; border:none; border-top:1px solid #e5e7eb;" />

        <div class="text-gray-500" style="text-align:center;">
          ניתן למצוא את היועץ/ת האקדמי/ת שלך גם דרך התפריט למטה
        </div>
        ${formsHtml}
      </div>`;
  }

  /* ---------- LABS ---------- */
  if (intent === "labs") {
    const labs = doc.contacts?.labs || [];
    if (!labs.length)
      return `<div class="text-sm">ℹ️ אין אחראי/ת מעבדות בסמסטר ${sem}.</div>`;
    return `
      <div class="text-sm">
        <b class="bot-title">אחראי/ת מעבדות – סמסטר ${sem}</b><br/><br/>
        ${labs.map(l =>
          `• ${l.name} – <a href="mailto:${l.email}">${l.email}</a>`
        ).join("<br/>")}
      </div>`;
  }

  /* ---------- MENTORS ---------- */
  if (intent === "mentors") {
    const m = doc.contacts?.mentors || [];
    if (!m.length)
      return `<div class="text-sm">ℹ️ אין סטודנט/ית מלווה בסמסטר ${sem}.</div>`;
    return `
      <div class="text-sm">
        <b class="bot-title">סטודנט/ית מלווה – סמסטר ${sem}</b><br/><br/>
        ${m.map(x =>
          `• ${x.name} – <a href="mailto:${x.email}">${x.email}</a>`
        ).join("<br/>")}
      </div>`;
  }

  /* ---------- EXEMPTIONS ---------- */
  if (intent === "exemptions") {
    const e = doc.contacts?.exemptions || [];
    const formsHtml = appendForms(forms, intent);
    if (!e.length)
      return `<div class="text-sm">ℹ️ אין מידע על פטורים בסמסטר זה.${formsHtml}</div>`;
    return `
      <div class="text-sm">
        <b class="bot-title">פטורים / חריגים</b><br/><br/>
        ${e.map((x) => `• ${x.name} - <a href="mailto:${x.email}">${x.email}</a>`).join("<br/>")}
        ${formsHtml}
      </div>`;
  }

  /* ---------- INTERNSHIP ---------- */
  if (intent === "internship") {
    const rules = (doc.keyRules || [])
      .filter(r => r.code?.includes("INTERNSHIP"))
      .map(r => `• ${r.text}`)
      .join("<br/>");

    return `
      <div class="text-sm">
        <b class="bot-title">סטאז' / התמחות – סמסטר ${sem}</b><br/><br/>
        ${rules || "מידע על סטאז' מתפרסם לפי סמסטר ובהנחיות המחלקה."}
      </div>`;
  }

  /* ---------- CREDITS ---------- */
  if (intent === "credits") {
    return `
      <div class="text-sm">
        <b class="bot-title">נקודות זכות</b><br/>
        ${doc.audience?.creditsRuleText || "נדרש מינימום 165 נ״ז"}
      </div>`;
  }

  /* ---------- CONTACTS ---------- */
  if (intent === "contacts") {
    const c = doc.contacts?.registrationSupport || [];
    const formsHtml = appendForms(forms, intent);
    if (!c.length)
      return `<div class="text-sm">ℹ️ אין איש קשר ייעודי לרישום בסמסטר זה.${formsHtml}</div>`;
    return `
      <div class="text-sm">
        <b class="bot-title">אנשי קשר לרישום</b><br/><br/>
        ${c.map((x) => `• ${x.name} - <a href="mailto:${x.email}">${x.email}</a>`).join("<br/>")}
        ${formsHtml}
      </div>`;
  }

  return `<div class="text-sm"><span class="bot-title">${doc.title}</span>${appendForms(forms, "general")}</div>`;
}

/* =============================
   Builders – ALL semesters
============================= */
export function buildAllAdvisorsAnswer(docs = []) {
  if (!docs.length) {
    return `<div class="text-sm">לא נמצאו יועצים אקדמיים.</div>`;
  }

  return `
    <div class="text-sm">
      <b class="bot-title">יועצים אקדמיים לפי סמסטר</b><br/><br/>

      ${docs
        .map(d => {
          const a = d.contacts?.academicAdvisors || [];
          if (!a.length) return "";

          return `
            <div style="margin-bottom:10px;">
              <b class="bot-subtitle">סמסטר ${d.semesterNumber}</b><br/>
              ${a
                .map(x =>
                  `• ${x.name} – <a href="mailto:${x.email}">${x.email}</a>`
                )
                .join("<br/>")}
            </div>
          `;
        })
        .join("")}

      <br/>

      <p class="text-gray-500" style="text-align:center; margin-top:8px;">
        ℹ️ ניתן למצוא את היועץ/ת האקדמי/ת שלך גם דרך התפריט למטה ⬇️
      </p>
    </div>
  `;
}

export function buildAllLabsAnswer(docs) {
  return `
    <div class="text-sm">
      <b class="bot-title">אחראי/ת מעבדות לפי סמסטר</b><br/><br/>
      ${docs.map(d => {
        const l = d.contacts?.labs || [];
        if (!l.length) return "";
        return `<b class="bot-subtitle">סמסטר ${d.semesterNumber}</b><br/>` +
          l.map(x =>
            `• ${x.name} – <a href="mailto:${x.email}">${x.email}</a>`
          ).join("<br/>");
      }).join("<br/><br/>")}
    </div>`;
}

// Returns an HTML answer for a registration question. `aspect` is one of:
// window | advisors | mentors | credits | links | internship | exemptions |
// contacts | labs | general.
export async function answerRegistration({ semester = null, aspect = "general", forms = [] } = {}) {
  const finalIntent = aspect || "general";
  const semNum = semester;

  if (finalIntent === "window" && !semNum) {
    const allDocs = await getAllRegDocs();
    return `
      <div class="text-sm leading-6">
        <b class="bot-title">⏰ חלונות רישום לכל הסמסטרים</b><br/><br/>
        ${allDocs
          .map(
            (d) => `
          <div class="mb-2">
            <b class="bot-subtitle">סמסטר ${d.semesterNumber}</b>
            ${d.audience?.cohortText ? ` (${d.audience.cohortText})` : ""}<br/>
            ${formatRegistrationWindow(d.registrationWindow)}
          </div>
        `
          )
          .join("")}
      </div>`;
  }

  if (!semNum) {
    const allDocs = await getAllRegDocs();

    if (finalIntent === "credits") {
      return `<div class="text-sm"><b class="bot-title">נקודות זכות לתואר</b><br/>נדרש מינימום 165 נ״ז</div>`;
    }

    if (finalIntent === "exemptions") {
      return `<div class="text-sm">ℹ️ פטורים וחריגים מטופלים מול הגורם האקדמי הרלוונטי.<br/>אנא ציין/י סמסטר או פנה/י ליועץ/ת האקדמי/ת.</div>`;
    }

    if (finalIntent === "contacts") {
      return `<div class="text-sm">ℹ️ לפניות בנושא רישום ניתן לפנות ליועצים האקדמיים או לתמיכת הרישום של הסמסטר הרלוונטי.</div>`;
    }

    if (finalIntent === "advisors") return buildAllAdvisorsAnswer(allDocs);
    if (finalIntent === "labs") return buildAllLabsAnswer(allDocs);

    if (finalIntent === "mentors") {
      const docsWithMentors = allDocs.filter((d) => (d.contacts?.mentors || []).length > 0);
      if (!docsWithMentors.length) return `<div class="text-sm">ℹ️ אין סטודנט/ית מלווה בשנתון זה.</div>`;
      if (docsWithMentors.length === 1) {
        const d = docsWithMentors[0];
        const m = d.contacts.mentors[0];
        return `<div class="text-sm leading-6">👩‍🎓 <b class="bot-title">סטודנט/ית מלווה יש רק בסמסטר ${d.semesterNumber}</b><br/><br/>• <b>${m.name}</b><br/><a href="mailto:${m.email}">${m.email}</a></div>`;
      }
      return `<div class="text-sm">ℹ️ יש מספר מלווים. אנא ציין/י סמסטר.</div>`;
    }

    if (finalIntent === "links") {
      const docsWithLinks = allDocs.filter((d) => (d.links || []).length > 0);
      if (!docsWithLinks.length) return `<div class="text-sm">ℹ️ לא נמצאו קישורי הדרכה.</div>`;
      if (docsWithLinks.length === 1) return await buildRegistrationAnswer("links", docsWithLinks[0]);
      return `<div class="text-sm"><b class="bot-title">קישורי הדרכה לפי סמסטר</b><br/><br/>${docsWithLinks
        .map(
          (d) =>
            `<b class="bot-subtitle">סמסטר ${d.semesterNumber}</b><br/>` +
            d.links.map((l) => `• <a href="${l.url}" target="_blank">${l.label}</a>`).join("<br/>")
        )
        .join("<br/><br/>")}</div>`;
    }

    if (finalIntent === "internship") {
      return `<div class="text-sm">ℹ️ תנאי סטאז' משתנים לפי סמסטר. אנא ציין/י סמסטר.</div>`;
    }

    if (finalIntent === "general") {
      return `<div class="text-sm">ℹ️ ניתן לשאול על רישום: חלון רישום, יועצים, מעבדות (אנשי קשר), מלווה, נקודות זכות, קישורים או תנאי סטאז'.</div>`;
    }

    return `<div class="text-sm">ℹ️ אנא ציין/י סמסטר (לדוגמה: סמסטר 2)</div>`;
  }

  const regDoc = await getRegDoc(semNum);
  if (!regDoc) return `<div class="text-sm">❌ לא מצאתי הנחיות רישום לסמסטר ${semNum}.</div>`;

  if (finalIntent === "internship") {
    const rules = (regDoc.keyRules || []).filter((r) => r.code?.includes("INTERNSHIP"));
    if (!rules.length) return `<div class="text-sm">ℹ️ אין מידע על סטאז' בסמסטר זה.</div>`;
    return `<div class="text-sm"><b class="bot-title">תנאי סטאז' – סמסטר ${semNum}</b><br/><br/>${rules
      .map((r) => `• ${r.text}`)
      .join("<br/>")}</div>`;
  }

  return await buildRegistrationAnswer(finalIntent, regDoc, { forms });
}



