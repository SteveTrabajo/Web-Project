import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import RegistrationImport from "./admin/RegistrationImport.jsx";
import { Icons } from "./admin/registrationIcons.jsx";
import {
  Field, SectionHeader, Btn, DangerBtn, TextInput, TextArea, Card, ContactSection,
} from "./admin/registrationFields.jsx";
import {
  emptyPerson, emptyMentor, emptyAdvisor, emptyLabContact, emptyRule, emptyLink,
} from "./admin/registrationSchema.js";

const SEMS = [1, 2, 3, 4, 5, 6, 7, 8];

const SUBVIEWS = [
  { id: "general",  label: "מידע כללי" },
  { id: "contacts", label: "אנשי קשר" },
  { id: "rules",    label: "כללים וקישורים" },
  { id: "import",   label: "ייבוא מקובץ" },
];

const emptyDoc = (semesterNumber = 1) => ({
  semesterNumber,
  term: "",
  title: "",
  registrationWindow: { date: "", from: "", to: "" },
  audience: {
    cohortText: "",
    creditsRuleText: null,
    creditsRange: null, // {min,max} or null
  },
  contacts: {
    registrationSupport: [],
    mentors: [],
    academicAdvisors: [],
    exemptions: [],
    labs: [],
  },
  keyRules: [],
  links: [],
});

const deepClone = (x) => JSON.parse(JSON.stringify(x));

export default function AdminRegistrationGuidelines({ apiFetch, toast }) {
  const [semester, setSemester] = useState(1);
  const [doc, setDoc] = useState(emptyDoc(1));
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState("general");
  const [syncPreview, setSyncPreview] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const update = (path, value) => {
    setDoc((prev) => {
      const next = deepClone(prev);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next;
    });
    setDirty(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/registration-guidelines/${semester}`);
      const d = data?.doc || data?.data || null;

      if (!d) {
        setDoc(emptyDoc(semester));
        toast("ok", "ℹ️ אין מסמך קיים — אפשר ליצור ולשמור");
      } else {
        const merged = deepClone(emptyDoc(semester));
        Object.assign(merged, d);
        merged.registrationWindow = { ...merged.registrationWindow, ...(d.registrationWindow || {}) };
        merged.audience = { ...merged.audience, ...(d.audience || {}) };
        merged.contacts = { ...merged.contacts, ...(d.contacts || {}) };
        merged.semesterNumber = semester;
        setDoc(merged);
        toast("ok", "✅ נטען בהצלחה");
      }
      setDirty(false);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* Advisors are stored twice: here, and in the academicAdvisors collection that
     the bot's letter/track picker reads. Saving offers to reconcile the two -
     the admin sees the diff and approves it; nothing is written otherwise. */
  const previewAdvisorSync = async () => {
    const advisors = (doc.contacts?.academicAdvisors || []).filter((a) => a.name);
    if (!advisors.length) return;
    try {
      const data = await apiFetch("/api/admin/advisors/sync/preview", {
        method: "POST",
        body: { advisors },
      });
      const pending = (data.rows || []).filter((r) => r.status !== "same");
      setSyncPreview(pending.length ? { rows: pending, counts: data.counts } : null);
    } catch {
      // A failed preview must not make the save look failed - it already succeeded.
    }
  };

  const applyAdvisorSync = async () => {
    setSyncing(true);
    try {
      const data = await apiFetch("/api/admin/advisors/sync/apply", {
        method: "POST",
        body: { rows: syncPreview.rows },
      });
      toast("ok", `✅ ${data.written} יועצים סונכרנו לטאב היועצים`);
      setSyncPreview(null);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const save = async () => {
    try {
      await apiFetch(`/api/admin/registration-guidelines/${semester}`, {
        method: "PUT",
        body: { ...doc, semesterNumber: semester },
      });
      toast("ok", "✅ ההנחיות נשמרו");
      setDirty(false);
      load();
      previewAdvisorSync();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  useEffect(() => {
    load();
    setSyncPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  /* Merges an analysed DOCX patch into the open form. Called by the import
     screen after the admin has reviewed the destination map; still not saved. */
  const applyImportedPatch = (p = {}) => {
    setDoc((prev) => {
      const next = deepClone(prev);
      if (p.title) next.title = p.title;
      if (p.term) next.term = p.term;
      next.audience = { ...next.audience, ...(p.audience || {}) };
      // Rules and links come wholesale from the document; contacts merge per
      // category so manually added people are not dropped by an import.
      next.keyRules = p.keyRules || [];
      next.links = p.links || [];
      for (const [key, list] of Object.entries(p.contacts || {})) {
        const existing = next.contacts?.[key] || [];
        const seen = new Set(list.map((c) => `${c.name}|${c.email}`));
        next.contacts[key] = [
          ...list,
          ...existing.filter((c) => !seen.has(`${c.name}|${c.email}`)),
        ];
      }
      next.semesterNumber = semester;
      return next;
    });
    setDirty(true);
    toast("ok", "✅ הנתונים נטענו לטופס. יש לבדוק ולשמור");
  };

  const add = (path, item) => {
    setDoc((prev) => {
      const next = deepClone(prev);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length; i++) cur = cur[parts[i]];
      cur.push(item);
      return next;
    });
    setDirty(true);
  };

  const remove = (path, idx) => {
    setDoc((prev) => {
      const next = deepClone(prev);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length; i++) cur = cur[parts[i]];
      cur.splice(idx, 1);
      return next;
    });
    setDirty(true);
  };

  const updateItem = (path, idx, key, value) => {
    setDoc((prev) => {
      const next = deepClone(prev);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length; i++) cur = cur[parts[i]];
      cur[idx][key] = value;
      return next;
    });
    setDirty(true);
  };

  return (
    <div className="space-y-4">

      {/* Header - same format as the other admin tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-heading">
          ניהול סמסטר
          {loading && (
            <span className="ms-2 text-caption font-normal text-muted-foreground animate-pulse">מסנכרן...</span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(semester)} onValueChange={(v) => setSemester(Number(v))}>
            <SelectTrigger dir="rtl" className="h-8 w-32">
              <span>סמסטר {semester}</span>
            </SelectTrigger>
            <SelectContent>
              {SEMS.map((s) => (
                <SelectItem key={s} value={String(s)}>סמסטר {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            רענון
          </Button>
          <Button
            size="sm"
            className="bg-bio-green dark:bg-bio-green-glow dark:text-brand-navy-deep hover:opacity-90"
            onClick={save}
          >
            שמירה{dirty ? "*" : ""}
          </Button>
        </div>
      </div>

      {/* Advisor sync proposal - shown after a save that changes advisor data */}
      {syncPreview && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:bg-indigo-950/20 dark:border-indigo-800">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                סנכרון יועצים לטאב היועצים
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-5 max-w-xl">
                היועצים שבמסמך ההנחיות אינם זהים לרשומים בטאב היועצים - שם מתבצע שיוך היועץ/ת
                לסטודנט/ית לפי אות ומסלול. אפשר לעדכן אותם כך שיתאימו למסמך. יועצים שקיימים רק
                בטאב היועצים לא יימחקו.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setSyncPreview(null)} disabled={syncing}>
                דילוג
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={applyAdvisorSync}
                disabled={syncing}
              >
                {syncing ? "מסנכרן..." : `סנכרון ${syncPreview.rows.length} יועצים`}
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {syncPreview.rows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-white border border-slate-200 p-3 text-xs dark:bg-slate-900 dark:border-slate-700"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      "px-2 py-0.5 rounded-full text-[10px] font-bold " +
                      (r.status === "new"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")
                    }
                  >
                    {r.status === "new" ? "חדש" : "עדכון"}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{r.advisor.name}</span>
                  <span className="text-slate-400">
                    סמסטרים {r.advisor.semesters.join(", ") || "-"} · {r.advisor.lastNameRanges.join(", ")}
                    {r.advisor.effectiveFrom ? ` · מתאריך ${r.advisor.effectiveFrom}` : ""}
                  </span>
                </div>
                {r.changes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-slate-500 dark:text-slate-400">
                    {r.changes.map((c) => (
                      <li key={c.field}>
                        {c.label}: <span className="line-through">{String(c.from) || "ריק"}</span>
                        {" -> "}
                        <span className="text-slate-800 dark:text-slate-100 font-medium">{String(c.to) || "ריק"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-view segmented control */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
        {SUBVIEWS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all " +
              (view === t.id
                ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- General info + registration window --- */}
      {view === "general" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <Card>
              <SectionHeader title="מידע כללי" icon={Icons.FileText} />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-8">
                  <Field label="כותרת ראשית להצגה">
                    <TextInput
                      value={doc.title || ""}
                      onChange={(e) => update("title", e.target.value)}
                      placeholder='לדוגמה: "הנחיות רישום מחושב לקורסים - סמסטר 1"'
                      className="font-bold text-base"
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label="סמסטר משנה">
                    <TextInput
                      value={doc.term || ""}
                      onChange={(e) => update("term", e.target.value)}
                      placeholder="A או B"
                      className="text-center font-mono"
                    />
                  </Field>
                </div>

                <div className="md:col-span-12">
                  <Field label="קהל יעד / קבוצה">
                    <TextInput
                      value={doc.audience?.cohortText || ""}
                      onChange={(e) => update("audience.cohortText", e.target.value)}
                      placeholder='לדוגמה: "שנתון חורף 2026 · ביוטכנולוגיה"'
                    />
                  </Field>
                </div>

                <div className="md:col-span-12">
                  <Field label="הנחיות נ״ז" hint="מופיע כטקסט בולט בממשק הסטודנט">
                    <TextArea
                      value={doc.audience?.creditsRuleText ?? ""}
                      onChange={(e) => update("audience.creditsRuleText", e.target.value || null)}
                      placeholder='לדוגמה: "מקסימום 24 נ״ז בסמסטר. מעל זה - באישור יועץ."'
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <Card className="border-t-4 border-t-indigo-500">
              <SectionHeader title="חלון רישום" icon={Icons.Clock} />
              <div className="space-y-4">
                <Field label="תאריך פתיחה">
                  <div className="relative">
                    <TextInput
                      type="date"
                      value={doc.registrationWindow?.date || ""}
                      onChange={(e) => update("registrationWindow.date", e.target.value)}
                      className="font-mono text-center"
                    />
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="התחלה">
                    <TextInput
                      type="time"
                      value={doc.registrationWindow?.from || ""}
                      onChange={(e) => update("registrationWindow.from", e.target.value)}
                      className="font-mono text-center"
                    />
                  </Field>
                  <Field label="סיום">
                    <TextInput
                      type="time"
                      value={doc.registrationWindow?.to || ""}
                      onChange={(e) => update("registrationWindow.to", e.target.value)}
                      className="font-mono text-center"
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* --- Contacts (each category full-width on its own row) --- */}
      {view === "contacts" && (
        <div className="space-y-4">
          <ContactSection
            title="תמיכה ומזכירות"
            items={doc.contacts?.registrationSupport}
            onAdd={() => add("contacts.registrationSupport", emptyPerson())}
            onRemove={(i) => remove("contacts.registrationSupport", i)}
            onChange={(i, k, v) => updateItem("contacts.registrationSupport", i, k, v)}
            type="simple"
          />
          <ContactSection
            title="יועצים אקדמיים"
            items={doc.contacts?.academicAdvisors}
            onAdd={() => add("contacts.academicAdvisors", emptyAdvisor())}
            onRemove={(i) => remove("contacts.academicAdvisors", i)}
            onChange={(i, k, v) => updateItem("contacts.academicAdvisors", i, k, v)}
            type="advisor"
          />
          <ContactSection
            title="מלווים (מנטורים)"
            items={doc.contacts?.mentors}
            onAdd={() => add("contacts.mentors", emptyMentor())}
            onRemove={(i) => remove("contacts.mentors", i)}
            onChange={(i, k, v) => updateItem("contacts.mentors", i, k, v)}
            type="simple"
          />
          <ContactSection
            title="חריגים ופטורים"
            items={doc.contacts?.exemptions}
            onAdd={() => add("contacts.exemptions", emptyPerson())}
            onRemove={(i) => remove("contacts.exemptions", i)}
            onChange={(i, k, v) => updateItem("contacts.exemptions", i, k, v)}
            type="simple"
          />
          <ContactSection
            title="מעבדות"
            items={doc.contacts?.labs}
            onAdd={() => add("contacts.labs", emptyLabContact())}
            onRemove={(i) => remove("contacts.labs", i)}
            onChange={(i, k, v) => updateItem("contacts.labs", i, k, v)}
            type="lab"
          />
        </div>
      )}

      {/* --- Key rules + links --- */}
      {view === "rules" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader
              title="כללים חשובים"
              icon={Icons.Info}
              action={
                <Btn onClick={() => add("keyRules", emptyRule())}>
                  <Icons.Plus className="w-3.5 h-3.5" /> הוספה
                </Btn>
              }
            />

            <div className="space-y-4">
              {(doc.keyRules || []).map((r, idx) => {
                const internalCode = r.code || `RULE_${idx + 1}`;

                return (
                  <div
                    key={idx}
                    className="group relative bg-slate-50/50 rounded-xl p-4 border border-slate-200 transition-all hover:bg-white hover:border-indigo-200 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-800/70 dark:hover:border-indigo-500/40"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="grow">
                        <Field
                          label="מה יופיע לסטודנטים (הנחיה חשובה)"
                          hint="לכתוב כאן את הכלל כפי שיופיע בעמוד ההנחיות."
                        >
                          <TextArea
                            value={r.text || ""}
                            onChange={(e) => {
                              // Always persist the internal code alongside the display text; code is not shown in the UI.
                              updateItem("keyRules", idx, "code", internalCode);
                              updateItem("keyRules", idx, "text", e.target.value);
                            }}
                            placeholder="לדוגמה: חובה להירשם לקורסי חובה לפני בחירה חופשית..."
                            className="min-h-27.5 leading-6"
                          />
                        </Field>

                        {/* Displays the auto-generated internal ID as read-only text rather than an editable code field */}
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          מזהה פנימי אוטומטי: <span className="font-mono">{internalCode}</span>
                        </div>
                      </div>

                      <div className="pt-7">
                        <DangerBtn onClick={() => remove("keyRules", idx)} title="מחיקת כלל">
                          <Icons.Trash />
                        </DangerBtn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="קישורים שימושיים"
              icon={Icons.Link}
              action={
                <Btn onClick={() => add("links", emptyLink())}>
                  <Icons.Plus className="w-3.5 h-3.5" /> הוספה
                </Btn>
              }
            />
            <div className="space-y-3">
              {(doc.links || []).map((l, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-start p-3 rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md hover:border-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-indigo-500/40">
                  <div className="w-full md:w-1/3">
                    <Field label="כותרת">
                      <TextInput
                        value={l.label || ""}
                        onChange={(e) => updateItem("links", idx, "label", e.target.value)}
                        placeholder="שם הקישור"
                      />
                    </Field>
                  </div>
                  <div className="w-full md:grow">
                    <Field label="URL">
                      <TextInput
                        value={l.url || ""}
                        onChange={(e) => updateItem("links", idx, "url", e.target.value)}
                        placeholder="https://..."
                        className="font-mono text-indigo-600 dark:text-indigo-300 ltr"
                      />
                    </Field>
                  </div>
                  <div className="md:pt-6">
                    <DangerBtn onClick={() => remove("links", idx)}><Icons.Trash /></DangerBtn>
                  </div>
                </div>
              ))}
              {!(doc.links || []).length && <p className="text-slate-400 text-xs italic text-center">אין קישורים</p>}
            </div>
          </Card>
        </div>
      )}

      {/* --- Guided DOCX import --- */}
      {view === "import" && (
        <RegistrationImport
          semester={semester}
          doc={doc}
          update={update}
          add={add}
          remove={remove}
          updateItem={updateItem}
          onImport={applyImportedPatch}
          onSave={save}
          dirty={dirty}
          toast={toast}
        />
      )}
    </div>
  );
}
