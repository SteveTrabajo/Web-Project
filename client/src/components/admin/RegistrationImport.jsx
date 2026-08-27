import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/*
 * Guided import for the "הנחיות כלליות לרישום" DOCX.
 *
 * Three steps: pick a file -> review what the parser found and where each part
 * will land -> import. Nothing is written until the admin presses the import
 * button in step 2, and step 3 reports exactly where everything went.
 *
 * The parent owns the semester and the registration doc; this component only
 * hands back the parsed patch via onImport.
 */

const STEPS = [
  { id: 1, label: "בחירת קובץ" },
  { id: 2, label: "בדיקת הניתוח" },
  { id: 3, label: "סיכום" },
];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
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
          {i < STEPS.length - 1 && <span className="text-slate-300 dark:text-slate-600">←</span>}
        </div>
      ))}
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
                  {r.detail && (
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5 leading-5">{r.detail}</div>
                  )}
                </td>
                <td className="py-2 pe-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.count}</td>
                <td className="py-2">
                  <div className="text-slate-800 dark:text-slate-100">
                    טאב <span className="font-semibold">{r.view}</span>
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

export default function RegistrationImport({ semester, onImport, toast }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(1);

  const reset = () => {
    setFile(null);
    setResult(null);
    setStep(1);
    if (fileRef.current) fileRef.current.value = "";
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
    onImport(result.patch);
    setStep(3);
  };

  const importedRows = (result?.destinations || []).filter((r) => r.status === "import");
  const nothingToImport = step === 2 && importedRows.length === 0;

  return (
    <div className="space-y-5">
      <StepBar current={step} />

      {/* ---- Step 1: pick a file ---- */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
            ייבוא הנחיות רישום לסמסטר {semester}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-5 max-w-2xl">
            העלאת קובץ "הנחיות כלליות לרישום" (DOCX). הקובץ ינותח בלבד - שום דבר לא יישמר עד
            לאישור בשלב הבא. ודא/י שנבחר הסמסטר הנכון למעלה, כיוון שטבלת היועצים מסוננת לפיו.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:me-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
            />
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

      {/* ---- Step 2: review ---- */}
      {step === 2 && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {result.meta?.title || "הנחיות רישום"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {result.meta?.termText || ""} · יעד: סמסטר {result.semester}
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
                  ייבוא לטופס
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
                אלה שדות ריקים או לא מזוהים במסמך המקור, לא שגיאות ייבוא. אפשר להשלים אותם ידנית
                בטפסים לאחר הייבוא.
              </p>
              <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
                {result.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---- Step 3: summary ---- */}
      {step === 3 && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 dark:bg-emerald-950/20 dark:border-emerald-800">
            <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
              הנתונים יובאו לטופס
            </div>
            <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90 mt-1.5 leading-5 max-w-2xl">
              המידע נטען לטפסים של סמסטר {result.semester} אך <b>עדיין לא נשמר</b>. עבור/י לטאבים
              למטה כדי לבדוק, ואז לחצ/י "שמירה" בראש העמוד. לאחר השמירה תוצע גם התאמה של היועצים
              לטאב היועצים.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
              לאן נכנס כל חלק
            </div>
            <DestinationTable rows={result.destinations || []} />
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reset}>
              ייבוא קובץ נוסף
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
