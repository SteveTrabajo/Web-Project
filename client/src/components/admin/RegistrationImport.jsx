import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "./registrationIcons.jsx";
import {
  Field, Btn, DangerBtn, TextInput, TextArea, ContactSection,
} from "./registrationFields.jsx";
import { emptyPerson, emptyMentor, emptyAdvisor, emptyLabContact, emptyRule, emptyLink } from "./registrationSchema.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/*
 * Guided import for the "הנחיות כלליות לרישום" DOCX.
 *
 * 1. בחירת קובץ  - drop or pick a file, nothing leaves the browser until ניתוח
 * 2. בדיקת הניתוח - what the parser found and which field each part lands in
 * 3. עריכה ושמירה - the imported data itself, editable in place, so the admin
 *    never has to hunt across the other tabs to verify an import
 *
 * The parent owns the document state; this screen edits it through the same
 * helpers the main editor uses, so both stay in sync.
 */

const STEPS = [
  { id: 1, label: "בחירת קובץ" },
  { id: 2, label: "בדיקת הניתוח" },
  { id: 3, label: "עריכה ושמירה" },
];

const CONTACT_SECTIONS = [
  { key: "academicAdvisors", title: "יועצים אקדמיים", type: "advisor", factory: emptyAdvisor },
  { key: "registrationSupport", title: "תמיכה ומזכירות", type: "simple", factory: emptyPerson },
  { key: "mentors", title: "מלווים (מנטורים)", type: "simple", factory: emptyMentor },
  { key: "exemptions", title: "חריגים ופטורים", type: "simple", factory: emptyPerson },
  { key: "labs", title: "מעבדות", type: "lab", factory: emptyLabContact },
];

// Counts used for the before/after summary once the patch is applied.
function snapshot(doc = {}) {
  const c = doc.contacts || {};
  return {
    keyRules: (doc.keyRules || []).length,
    links: (doc.links || []).length,
    academicAdvisors: (c.academicAdvisors || []).length,
    registrationSupport: (c.registrationSupport || []).length,
    mentors: (c.mentors || []).length,
    exemptions: (c.exemptions || []).length,
    labs: (c.labs || []).length,
    creditsRange: doc.audience?.creditsRange
      ? `${doc.audience.creditsRange.min ?? "?"}-${doc.audience.creditsRange.max ?? "?"}`
      : "",
    title: doc.title || "",
  };
}

const CHANGE_LABELS = {
  keyRules: "כללים",
  links: "קישורים",
  academicAdvisors: "יועצים אקדמיים",
  registrationSupport: "תמיכה ומזכירות",
  mentors: "מלווים",
  exemptions: "חריגים ופטורים",
  labs: "מעבדות",
  creditsRange: "מגבלות נ\"ז",
  title: "כותרת",
};

function diffSnapshots(before, after) {
  const out = [];
  for (const [key, label] of Object.entries(CHANGE_LABELS)) {
    const b = before?.[key];
    const a = after?.[key];
    if (String(b) === String(a)) continue;
    out.push({ label, before: b === 0 || b === "" ? "ריק" : b, after: a === 0 || a === "" ? "ריק" : a });
  }
  return out;
}

function StepBar({ current, onBack }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div
              className={
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors " +
                (current === s.id
                  ? "bg-indigo-600 text-white"
                  : current > s.id
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500")
              }
            >
              <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                {current > s.id ? "✓" : s.id}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <span className="text-slate-300 dark:text-slate-600 text-xs">←</span>}
          </div>
        ))}
      </div>
      {onBack && (
        <Button size="sm" variant="outline" onClick={onBack}>
          חזרה
        </Button>
      )}
    </div>
  );
}

// Collapsible wrapper matching ContactSection, for the non-contact categories.
function Section({ title, count, tone = "slate", defaultOpen = false, action, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const toneCls =
    tone === "emerald"
      ? "bg-emerald-50/60 dark:bg-emerald-950/20"
      : "bg-slate-50/50 dark:bg-slate-800/40";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800 transition-all hover:border-indigo-300">
      <div
        className={`p-4 flex items-center justify-between cursor-pointer select-none ${toneCls}`}
        onClick={() => setOpen(!open)}
        role="button"
        aria-expanded={open}
      >
        <div className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
          {title}
          {count != null && (
            <span className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] px-1.5 rounded-full min-w-[1.2rem] text-center">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <Icons.Chevron
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            onClick={() => setOpen(!open)}
          />
        </div>
      </div>
      {open && <div className="p-4 border-t border-slate-100 dark:border-slate-800">{children}</div>}
    </div>
  );
}

function DestinationTable({ rows }) {
  const imported = rows.filter((r) => r.status === "import");
  const skipped = rows.filter((r) => r.status === "skip");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="text-right py-2 font-semibold">מה נמצא במסמך</th>
              <th className="text-right py-2 font-semibold">כמות</th>
              <th className="text-right py-2 font-semibold">לאן זה נכנס</th>
            </tr>
          </thead>
          <tbody>
            {imported.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 align-top">
                <td className="py-2 pe-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{r.label}</div>
                  {r.detail && <div className="text-slate-500 dark:text-slate-400 mt-0.5 leading-5">{r.detail}</div>}
                </td>
                <td className="py-2 pe-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.count}</td>
                <td className="py-2">
                  <div className="text-slate-800 dark:text-slate-100">
                    קטגוריה: <span className="font-semibold">{r.view}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5 break-all">{r.store}</div>
                  {r.alsoNeedsSync && (
                    <div className="mt-1 text-amber-700 dark:text-amber-400">
                      + טאב היועצים - דורש אישור סנכרון נפרד לאחר השמירה
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {skipped.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:bg-slate-800/40 dark:border-slate-700">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            נמצא במסמך אך לא מיובא כאן
          </div>
          <ul className="space-y-1.5 text-xs">
            {skipped.map((r, i) => (
              <li key={i} className="text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-200">{r.label}</span>
                {r.count ? ` (${r.count} שורות)` : ""} - {r.store}
                {r.detail && <div className="text-[10px] mt-0.5 opacity-70 break-all">{r.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function RegistrationImport({
  semester, doc, update, add, remove, updateItem, onImport, onSave, dirty, toast,
}) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [before, setBefore] = useState(null);
  const [step, setStep] = useState(1);

  const reset = () => {
    setFile(null);
    setResult(null);
    setBefore(null);
    setStep(1);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) {
      return toast("error", "יש לבחור קובץ מסוג DOCX");
    }
    setFile(f);
  };

  const analyze = async () => {
    if (!file) return toast("error", "יש לבחור קובץ DOCX");
    setAnalyzing(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("semester", String(semester));

      const token = JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token;
      const res = await fetch(`${API_BASE}/api/admin/upload/registration-guidelines`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בניתוח הקובץ");

      setResult(data);
      setStep(2);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmImport = () => {
    setBefore(snapshot(doc));
    onImport(result.patch);
    setStep(3);
  };

  const importedRows = (result?.destinations || []).filter((r) => r.status === "import");
  const nothingToImport = step === 2 && importedRows.length === 0;
  const changes = before ? diffSnapshots(before, snapshot(doc)) : [];
  const cr = doc?.audience?.creditsRange || null;

  const setCredits = (key, value) => {
    const next = { ...(cr || { min: null, max: null }) };
    next[key] = value === "" ? null : Number(value);
    update("audience.creditsRange", next.min == null && next.max == null ? null : next);
  };

  return (
    <div className="space-y-5">
      <StepBar current={step} onBack={step > 1 ? () => setStep(step - 1) : null} />

      {/* ---- Step 1: pick a file ---- */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
            ייבוא הנחיות רישום לסמסטר {semester}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-5 max-w-2xl">
            הקובץ ינותח בלבד ולא יישמר. בשלב הבא יוצג בדיוק מה נמצא ולאן הוא נכנס, ואז אפשר יהיה
            לערוך הכל כאן לפני השמירה. ודא/י שנבחר הסמסטר הנכון למעלה, כיוון שטבלת היועצים מסוננת לפיו.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            className={
              "mt-4 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors " +
              (dragging
                ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60 dark:border-slate-700 dark:hover:bg-slate-800/40")
            }
          >
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              גרירת קובץ DOCX לכאן, או לחיצה לבחירה
            </div>
            <div className="text-[11px] text-slate-400 mt-1">קובץ "הנחיות כלליות לרישום"</div>
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:bg-slate-800/40 dark:border-slate-700">
              <div className="text-xs min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</div>
                <div className="text-slate-400">{(file.size / 1024).toFixed(0)} KB</div>
              </div>
              <DangerBtn onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                <Icons.Trash />
              </DangerBtn>
            </div>
          )}

          <div className="mt-4">
            <Button
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={analyze}
              disabled={!file || analyzing}
            >
              {analyzing ? "מנתח..." : "ניתוח הקובץ"}
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 2: review the analysis ---- */}
      {step === 2 && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {result.meta?.title || "הנחיות רישום"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {result.meta?.termText || ""} · יעד: סמסטר {result.semester}
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2.5">
                  {importedRows.map((r, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    >
                      {r.count} {r.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={reset}>
                  קובץ אחר
                </Button>
                <Button
                  size="sm"
                  className="bg-bio-green dark:bg-bio-green-glow dark:text-brand-navy-deep hover:opacity-90"
                  onClick={confirmImport}
                  disabled={nothingToImport}
                >
                  ייבוא ועריכה
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {nothingToImport ? (
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  לא נמצא במסמך מידע שניתן לייבא לסמסטר {result.semester}. ייתכן שזה אינו קובץ
                  ההנחיות הכלליות לרישום.
                </div>
              ) : (
                <DestinationTable rows={result.destinations || []} />
              )}
            </div>
          </div>

          {result.warnings?.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-950/20 dark:border-amber-800">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                חוסרים שזוהו במסמך ({result.warnings.length})
              </div>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mb-2 leading-5">
                אלה שדות ריקים או לא מזוהים במסמך המקור, לא שגיאות ייבוא. אפשר להשלים אותם בשלב הבא.
              </p>
              <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
                {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---- Step 3: edit the imported data in place, then save ---- */}
      {step === 3 && result && (
        <div className="space-y-4">
          {/* Sticky action bar so save is reachable without scrolling back up */}
          <div className="sticky top-2 z-10 rounded-2xl border border-emerald-300 bg-emerald-50/90 backdrop-blur p-4 dark:bg-emerald-950/40 dark:border-emerald-800">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  הנתונים יובאו לסמסטר {result.semester} - נותר לבדוק ולשמור
                </div>
                <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-1 leading-5">
                  כל מה שיובא מוצג ונערך כאן למטה. השמירה כותבת לשרת ומציעה גם התאמה של היועצים
                  לטאב היועצים.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={reset}>
                  ייבוא קובץ נוסף
                </Button>
                <Button
                  size="sm"
                  className="bg-bio-green dark:bg-bio-green-glow dark:text-brand-navy-deep hover:opacity-90"
                  onClick={onSave}
                >
                  שמירה{dirty ? "*" : ""}
                </Button>
              </div>
            </div>
          </div>

          {/* What changed relative to what was loaded before the import */}
          <Section title="סיכום השינויים" count={changes.length} tone="emerald" defaultOpen>
            {changes.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                הנתונים במסמך זהים למה שכבר היה שמור לסמסטר זה.
              </div>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {changes.map((c, i) => (
                  <li key={i} className="flex gap-2 items-baseline flex-wrap">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-32">{c.label}</span>
                    <span className="line-through text-slate-400">{String(c.before)}</span>
                    <span className="text-slate-400">←</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{String(c.after)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* General info */}
          <Section title="מידע כללי" defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8">
                <Field label="כותרת ראשית">
                  <TextInput value={doc.title || ""} onChange={(e) => update("title", e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field label="סמסטר משנה">
                  <TextInput
                    value={doc.term || ""}
                    onChange={(e) => update("term", e.target.value)}
                    className="text-center font-mono"
                  />
                </Field>
              </div>
              <div className="md:col-span-12">
                <Field label="קהל יעד / קבוצה">
                  <TextInput
                    value={doc.audience?.cohortText || ""}
                    onChange={(e) => update("audience.cohortText", e.target.value)}
                  />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="מינימום נ״ז בסמסטר">
                  <TextInput
                    type="number"
                    value={cr?.min ?? ""}
                    onChange={(e) => setCredits("min", e.target.value)}
                    className="text-center font-mono"
                  />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="מקסימום נ״ז בסמסטר">
                  <TextInput
                    type="number"
                    value={cr?.max ?? ""}
                    onChange={(e) => setCredits("max", e.target.value)}
                    className="text-center font-mono"
                  />
                </Field>
              </div>
              <div className="md:col-span-6">
                <Field label="הנחיות נ״ז (טקסט)">
                  <TextInput
                    value={doc.audience?.creditsRuleText ?? ""}
                    onChange={(e) => update("audience.creditsRuleText", e.target.value || null)}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* Key rules */}
          <Section
            title="כללים חשובים"
            count={(doc.keyRules || []).length}
            action={
              <Btn onClick={() => add("keyRules", emptyRule())}>
                <Icons.Plus className="w-3.5 h-3.5" /> הוספה
              </Btn>
            }
          >
            <div className="space-y-3">
              {(doc.keyRules || []).map((r, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="grow">
                    <TextArea
                      value={r.text || ""}
                      onChange={(e) => {
                        updateItem("keyRules", idx, "code", r.code || `RULE_${idx + 1}`);
                        updateItem("keyRules", idx, "text", e.target.value);
                      }}
                      className="min-h-20 leading-6"
                    />
                    <div className="mt-1 text-[10px] text-slate-400 font-mono">{r.code || `RULE_${idx + 1}`}</div>
                  </div>
                  <DangerBtn onClick={() => remove("keyRules", idx)}><Icons.Trash /></DangerBtn>
                </div>
              ))}
              {!(doc.keyRules || []).length && (
                <p className="text-slate-400 text-xs italic text-center py-2">לא יובאו כללים</p>
              )}
            </div>
          </Section>

          {/* Links */}
          <Section
            title="קישורים"
            count={(doc.links || []).length}
            action={
              <Btn onClick={() => add("links", emptyLink())}>
                <Icons.Plus className="w-3.5 h-3.5" /> הוספה
              </Btn>
            }
          >
            <div className="space-y-3">
              {(doc.links || []).map((l, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-start">
                  <div className="w-full md:w-1/3">
                    <Field label="כותרת">
                      <TextInput value={l.label || ""} onChange={(e) => updateItem("links", idx, "label", e.target.value)} />
                    </Field>
                  </div>
                  <div className="w-full md:grow">
                    <Field label="URL">
                      <TextInput
                        value={l.url || ""}
                        onChange={(e) => updateItem("links", idx, "url", e.target.value)}
                        className="font-mono text-indigo-600 ltr"
                      />
                    </Field>
                  </div>
                  <div className="md:pt-6">
                    <DangerBtn onClick={() => remove("links", idx)}><Icons.Trash /></DangerBtn>
                  </div>
                </div>
              ))}
              {!(doc.links || []).length && (
                <p className="text-slate-400 text-xs italic text-center py-2">לא יובאו קישורים</p>
              )}
            </div>
          </Section>

          {/* Contacts, one collapsible block per category */}
          {CONTACT_SECTIONS.map((s) => (
            <ContactSection
              key={s.key}
              title={s.title}
              items={doc.contacts?.[s.key]}
              onAdd={() => add(`contacts.${s.key}`, s.factory())}
              onRemove={(i) => remove(`contacts.${s.key}`, i)}
              onChange={(i, k, v) => updateItem(`contacts.${s.key}`, i, k, v)}
              type={s.type}
            />
          ))}

          {/* Where everything landed, kept available for reference */}
          <Section title="לאן נכנס כל חלק" count={importedRows.length}>
            <DestinationTable rows={result.destinations || []} />
          </Section>

          {result.warnings?.length > 0 && (
            <Section title="חוסרים שזוהו במסמך" count={result.warnings.length}>
              <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
                {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
