import { useState } from "react";
import { apiFetch } from "./admin/utils/adminApi.js";

const STATUS_LABEL = {
  ok: { text: "תקין", cls: "text-green-700 dark:text-green-300" },
  ok_with_notes: { text: "תקין עם הערות", cls: "text-sky-700 dark:text-sky-300" },
  warning: { text: "אזהרה", cls: "text-amber-700 dark:text-amber-300" },
  empty: { text: "ריק", cls: "text-slate-600 dark:text-slate-400" },
  error: { text: "שגיאה", cls: "text-red-700 dark:text-red-300" },
};

function issueClassName(level) {
  if (level === "error") return "text-red-700 dark:text-red-300";
  if (level === "info") return "text-sky-700 dark:text-sky-300";
  return "text-amber-700 dark:text-amber-300";
}

function issuePrefix(level) {
  if (level === "error") return "⛔ ";
  if (level === "info") return "ℹ️ ";
  return "⚠️ ";
}

function IssueList({ issues }) {
  if (!issues?.length) return null;
  const warnings = issues.filter((i) => i.level === "warning" || i.level === "error");
  const infos = issues.filter((i) => i.level === "info");

  return (
    <div className="space-y-2 mt-2">
      {warnings.length > 0 && (
        <ul className="text-xs space-y-1 break-words">
          {warnings.map((issue, i) => (
            <li key={`w-${i}`} className={issueClassName(issue.level)}>
              {issuePrefix(issue.level)}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {infos.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 mb-1">
            מידע / הערות לא חוסמות
          </div>
          <ul className="text-xs space-y-1 break-words">
            {infos.map((issue, i) => (
              <li key={`i-${i}`} className={issueClassName("info")}>
                {issuePrefix("info")}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.warning;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border border-current ${s.cls}`}>
      {s.text}
    </span>
  );
}

const USAGE_LABEL = {
  advisor: "ייעוץ",
  exception_registration: "רישום חריג",
  other: "אחר",
};

/** מפרק הודעות טופס מהשרת לתצוגה נקייה (ללא URL מלא ברשימה) */
function parseFormMessages(messages = []) {
  const forms = [];
  const otherMessages = [];
  const formLineRe = /^טופס "(.+)" \(([^)]+)\): (https?:\/\/.+)$/;

  for (const m of messages) {
    const match = m.match(formLineRe);
    if (match) {
      forms.push({ label: match[1], usage: match[2], url: match[3] });
    } else {
      otherMessages.push(m);
    }
  }

  return { forms, otherMessages };
}

function FormsSectionCard({ section }) {
  if (!section) return null;

  const { forms, otherMessages } = parseFormMessages(section.messages);

  return (
    <div className="border rounded-2xl p-4 bg-white dark:bg-slate-900 dark:border-slate-700 space-y-3 overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-bold text-gray-800 dark:text-slate-100">טפסים</div>
        <StatusBadge status={section.status} />
      </div>

      {otherMessages.length > 0 && (
        <ul className="text-sm text-gray-700 dark:text-slate-200 space-y-1 list-disc list-inside break-words">
          {otherMessages.map((m, i) => (
            <li key={i} className="break-words">{m}</li>
          ))}
        </ul>
      )}

      {forms.length > 0 && (
        <div className="space-y-2 min-w-0">
          {forms.map((form, i) => (
            <div
              key={`${form.label}-${i}`}
              className="rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 min-w-0 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 items-center min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 dark:text-slate-400">שם טופס</div>
                  <div
                    className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate"
                    title={form.label}
                  >
                    {form.label}
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="text-xs text-gray-500 dark:text-slate-400">שימוש</div>
                  <div className="text-sm text-gray-700 dark:text-slate-200">
                    {USAGE_LABEL[form.usage] || form.usage}
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="text-xs text-gray-500 dark:text-slate-400">סטטוס</div>
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">תקין</div>
                </div>
                <div className="shrink-0">
                  <div className="text-xs text-gray-500 dark:text-slate-400 sm:invisible sm:h-0 sm:overflow-hidden">
                    פתיחה
                  </div>
                  <a
                    href={form.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline-offset-2 hover:underline"
                  >
                    פתיחה
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {section.issues?.length > 0 && <IssueList issues={section.issues} />}
    </div>
  );
}

function SectionCard({ title, section }) {
  if (!section) return null;
  return (
    <div className="border rounded-2xl p-4 bg-white dark:bg-slate-900 dark:border-slate-700 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-bold text-gray-800 dark:text-slate-100">{title}</div>
        <StatusBadge status={section.status} />
      </div>
      {section.messages?.length > 0 && (
        <ul className="text-sm text-gray-700 dark:text-slate-200 space-y-1 list-disc list-inside">
          {section.messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {section.issues?.length > 0 && <IssueList issues={section.issues} />}
    </div>
  );
}

export default function AdminKnowledgeCheck() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const runCheck = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/admin/knowledge-check");
      setReport(data);
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const overall = report ? STATUS_LABEL[report.status] || STATUS_LABEL.warning : null;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="space-y-1">
        <div className="text-lg font-bold text-gray-800 dark:text-slate-100">
          בדיקת מאגר הידע
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          מאגר ידע סגור — בודק שנתונים, לוחות מעבדה, הנחיות רישום, יועצים וטפסים שהוזנו
          למערכת בלבד (ללא מקורות חיצוניים).
        </p>
      </div>

      <button
        type="button"
        onClick={runCheck}
        disabled={loading}
        className="px-5 py-2 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500"
      >
        {loading ? "מריץ בדיקה..." : "הרצת בדיקת מאגר הידע"}
      </button>

      {error && (
        <div className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className="border rounded-2xl p-4 bg-slate-50 dark:bg-slate-950 dark:border-slate-700">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-gray-800 dark:text-slate-100">סיכום כללי</span>
              {overall && (
                <span className={`font-semibold ${overall.cls}`}>{overall.text}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{report.subtitle}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
              {[
                ["שנתונים", report.summary.yearbooksCount],
                ["קורסים", report.summary.coursesCount],
                ["קשרי קדם/צמוד", report.summary.relationsCount],
                ["שנות מעבדה", report.summary.labYearsCount],
                ["סמסטרי מעבדה", report.summary.labSemestersCount],
                ["שורות מעבדה", report.summary.labRowsCount],
                ["יועצים", report.summary.advisorsCount],
                ["הנחיות רישום", report.summary.registrationGuidelinesCount],
                ["טפסים", report.summary.formsCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border bg-white px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
                >
                  <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-slate-100">{value}</div>
                </div>
              ))}
            </div>

            {(report.warnings?.length > 0 ||
              report.infos?.length > 0 ||
              report.errors?.length > 0) && (
              <div className="mt-4 space-y-2">
                {report.errors?.length > 0 && (
                  <div>
                    <div className="text-sm font-bold text-red-700 dark:text-red-300">שגיאות</div>
                    <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside">
                      {report.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.warnings?.length > 0 && (
                  <div>
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-300">אזהרות</div>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside max-h-40 overflow-y-auto">
                      {report.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.infos?.length > 0 && (
                  <div>
                    <div className="text-sm font-bold text-sky-700 dark:text-sky-300">
                      מידע / הערות לא חוסמות
                    </div>
                    <ul className="text-xs text-sky-700 dark:text-sky-300 list-disc list-inside max-h-48 overflow-y-auto">
                      {report.infos.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="שנתונים וקורסים" section={report.sections?.yearbooks} />
            <SectionCard title="לוחות מעבדה" section={report.sections?.labs} />
            <SectionCard title="הנחיות רישום" section={report.sections?.registration} />
            <SectionCard title="יועצים" section={report.sections?.advisors} />
            <FormsSectionCard section={report.sections?.forms} />
          </div>

          {report.checkedAt && (
            <div className="text-[11px] text-gray-400 dark:text-slate-500">
              נבדק ב: {new Date(report.checkedAt).toLocaleString("he-IL")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
