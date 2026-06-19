import { useEffect, useMemo, useState } from "react";

const SEMS = [1, 2, 3, 4, 5, 6, 7, 8];

const SUBVIEWS = [
  { id: "general",  label: "מידע כללי" },
  { id: "contacts", label: "אנשי קשר" },
  { id: "rules",    label: "כללים וקישורים" },
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

const emptyPerson = () => ({ name: "", role: "", email: "", phone: "" });
const emptyMentor = () => ({ name: "", role: "", email: "" });
const emptyAdvisor = () => ({
  name: "",
  email: "",
  assignment: { lastNameFrom: "", lastNameTo: "", track: "" },
});
const emptyLabContact = () => ({ name: "", role: "", email: "", howToContact: "" });
const emptyRule = () => ({ code: "", text: "" });
const emptyLink = () => ({ label: "", url: "" });

const deepClone = (x) => JSON.parse(JSON.stringify(x));

// --- Icons (Inline SVGs for zero dependencies)
const Icons = {
  Save: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Refresh: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg>,
  Plus: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  Clock: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Info: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Users: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Link: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  FileText: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Chevron: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="6 9 12 15 18 9"/></svg>,
};

// --- Styled Components ---

function Field({ label, children, hint, className = "" }) {
  return (
    <div className={`group flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">
          {label}
        </label>
        {hint && (
          <div className="relative group/hint cursor-help">
            <Icons.Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500" />
            <div className="absolute bottom-full mb-2 hidden w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg group-hover/hint:block z-10 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              {hint}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        {Icon && <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400"><Icon /></div>}
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function Btn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 " +
        "bg-white border-slate-200 text-slate-700 shadow-sm " +
        "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow active:scale-95 " +
        "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all duration-200 " +
        "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 " +
        "dark:bg-indigo-500 dark:hover:bg-indigo-600 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function DangerBtn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors " +
        "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-transparent hover:border-red-200 " +
        "dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={
        "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-slate-50/50 " +
        "placeholder-slate-400 text-slate-800 font-medium " +
        "transition-all duration-200 ease-in-out " +
        "focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none " +
        "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:bg-slate-800 " +
        (props.className || "")
      }
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm bg-slate-50/50 " +
        "placeholder-slate-400 text-slate-800 leading-relaxed " +
        "transition-all duration-200 ease-in-out " +
        "focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none " +
        "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:bg-slate-800 " +
        "resize-y min-h-30 " +
        (props.className || "")
      }
    />
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800 dark:shadow-none ${className}`}>
      {children}
    </div>
  );
}

export default function AdminRegistrationGuidelines({ apiFetch, toast }) {
  const [semester, setSemester] = useState(1);
  const [doc, setDoc] = useState(emptyDoc(1));
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState("general");

  const docId = useMemo(() => `semester_${semester}`, [semester]);

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

  const save = async () => {
    try {
      await apiFetch(`/api/admin/registration-guidelines/${semester}`, {
        method: "PUT",
        body: { ...doc, semesterNumber: semester },
      });
      toast("ok", "✅ ההנחיות נשמרו");
      setDirty(false);
      load();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

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
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen dark:bg-black/20 font-sans">

      {/* Sticky Header */}
      <div className="sticky top-4 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap transition-all">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-6 bg-indigo-500 rounded-full inline-block"></span>
            ניהול סמסטר
          </h1>
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-2 mt-1">
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{docId}</span>
            {loading && <span className="animate-pulse text-indigo-500">● מסנכרן...</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <select
              className="appearance-none bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-2 text-sm font-semibold text-slate-700 cursor-pointer hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              {SEMS.map((s) => (
                <option key={s} value={s}>סמסטר {s}</option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 dark:bg-slate-700"></div>

          <Btn onClick={load} title="רענון נתונים">
            <Icons.Refresh className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">רענון</span>
          </Btn>
          <PrimaryBtn onClick={save} className={dirty ? "ring-2 ring-indigo-300 ring-offset-2 dark:ring-offset-slate-900" : ""}>
            <Icons.Save />
            <span>שמירה{dirty ? "*" : ""}</span>
          </PrimaryBtn>
        </div>
      </div>

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
                    className="group relative bg-slate-50/50 rounded-xl p-4 border border-slate-200 transition-all hover:bg-white hover:border-indigo-200 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700"
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
                            className="min-h-27.5 bg-white leading-6"
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
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-start p-3 rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md hover:border-indigo-100 dark:bg-slate-800 dark:border-slate-700">
                  <div className="w-full md:w-1/3">
                    <Field label="כותרת">
                      <TextInput
                        value={l.label || ""}
                        onChange={(e) => updateItem("links", idx, "label", e.target.value)}
                        placeholder="שם הקישור"
                        className="bg-slate-50"
                      />
                    </Field>
                  </div>
                  <div className="w-full md:grow">
                    <Field label="URL">
                      <TextInput
                        value={l.url || ""}
                        onChange={(e) => updateItem("links", idx, "url", e.target.value)}
                        placeholder="https://..."
                        className="font-mono text-indigo-600 bg-slate-50 ltr"
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
    </div>
  );
}

// --- Helper Component for Contact Lists to reduce clutter ---
function ContactSection({ title, items = [], onAdd, onRemove, onChange, type }) {
  const [isOpen, setIsOpen] = useState(false); // Collapsible for cleaner UI on mobile

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800 transition-all hover:border-indigo-300 hover:shadow-md">
      <div
        className="p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-expanded={isOpen}
      >
        <div className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Icons.Users className="w-4 h-4 text-slate-400" />
          {title}
          <span className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] px-1.5 rounded-full min-w-[1.2rem] text-center">{items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); setIsOpen(true); }}
            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded transition"
            title="הוסף איש קשר"
          >
            <Icons.Plus />
          </button>
          <Icons.Chevron className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* List */}
      {isOpen && (
        <div className="p-3 bg-white dark:bg-slate-900 space-y-3">
          {items.length === 0 && <div className="text-center text-xs text-slate-400 py-2">אין אנשי קשר ברשימה</div>}

          {items.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 group hover:border-indigo-200 hover:bg-white transition-colors dark:bg-slate-800/40 dark:border-slate-700">
              <div className="flex gap-3 items-start">
                <div className="grow space-y-3">
                  {/* One row per person: name, email, and role-specific fields side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="שם">
                      <TextInput value={item.name || ""} onChange={(e) => onChange(idx, "name", e.target.value)} />
                    </Field>
                    <Field label="אימייל">
                      <TextInput value={item.email || ""} onChange={(e) => onChange(idx, "email", e.target.value)} className="ltr text-left" />
                    </Field>

                    {(type === "simple" || type === "lab") && (
                      <Field label="תפקיד">
                        <TextInput value={item.role || ""} onChange={(e) => onChange(idx, "role", e.target.value)} />
                      </Field>
                    )}
                    {type === "simple" && item.phone !== undefined && (
                      <Field label="טלפון">
                        <TextInput value={item.phone || ""} onChange={(e) => onChange(idx, "phone", e.target.value)} className="ltr text-left" />
                      </Field>
                    )}
                    {type === "lab" && (
                      <Field label="איך לפנות?">
                        <TextInput value={item.howToContact || ""} onChange={(e) => onChange(idx, "howToContact", e.target.value)} />
                      </Field>
                    )}
                  </div>

                  {type === "advisor" && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                      <Field label="שיוך אלפביתי ומסלול">
                        <div className="flex gap-2 items-center flex-wrap">
                          <TextInput value={item.assignment?.lastNameFrom || ""} onChange={(e) => { const n = { ...item.assignment, lastNameFrom: e.target.value }; onChange(idx, "assignment", n); }} placeholder="א" className="text-center w-14" />
                          <span className="self-center text-slate-300">-</span>
                          <TextInput value={item.assignment?.lastNameTo || ""} onChange={(e) => { const n = { ...item.assignment, lastNameTo: e.target.value }; onChange(idx, "assignment", n); }} placeholder="ת" className="text-center w-14" />
                          <TextInput value={item.assignment?.track || ""} onChange={(e) => { const n = { ...item.assignment, track: e.target.value }; onChange(idx, "assignment", n); }} placeholder="מסלול" className="grow min-w-40" />
                        </div>
                      </Field>
                    </div>
                  )}
                </div>

                <div className="pt-7 shrink-0">
                  <DangerBtn onClick={() => onRemove(idx)} title="מחיקה"><Icons.Trash /></DangerBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
