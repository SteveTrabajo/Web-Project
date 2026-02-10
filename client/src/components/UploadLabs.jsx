import { useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";


/**
 * UploadLabs.jsx
 * ---------------
 * Admin component for uploading lab schedules from an Excel file.
 *
 * Features:
 * - Allows admin to select year ID, year label, semester, and Excel file.
 * - Sends FormData to backend to import labs.
 * - Displays success/error messages.
 *
 * Backend endpoint:
 * - POST /api/admin/upload/labs  (expects FormData: yearId, yearLabel, semester, file)
 */

export default function UploadLabs() {
  const fileRef = useRef(null);

  const [yearId, setYearId] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [semester, setSemester] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Opens hidden file input
  const chooseFile = () => fileRef.current?.click();

  /**
   * upload()
   * - Validates inputs.
   * - Sends Excel file and metadata to backend.
   * - Resets form on success.
   */
  const upload = async () => {
    if (!yearId || !yearLabel || !semester || !file) {
      setMsg({
        type: "error",
        text: "יש למלא שנה, סמסטר ולבחור קובץ Excel",
      });
      return;
    }

    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      const form = new FormData();
      form.append("yearId", yearId);
      form.append("yearLabel", yearLabel);
      form.append("semester", semester);
      form.append("file", file);

      const res = await fetch(`${API_BASE}/api/admin/upload/labs`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setMsg({ type: "ok", text: "✅ לוח המעבדות יובא בהצלחה" });

      // Reset form
      setFile(null);
      setYearId("");
      setYearLabel("");
      setSemester("");
      if (fileRef.current) fileRef.current.value = "";

    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI styles ----------
  const inputCls =
    "w-full rounded-xl border px-3 py-2 outline-none transition " +
    "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 " +
    "focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 " +
    "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 " +
    "dark:focus:ring-blue-400/25 dark:focus:border-blue-400";

  const selectCls =
    inputCls +
    " appearance-none " +
    "bg-[linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] " +
    "bg-[length:10px_10px,10px_10px] bg-[position:calc(1rem)_50%,calc(1.4rem)_50%] bg-no-repeat " +
    "pr-10";

  return (
    <div
      className={
        "border rounded-2xl p-4 space-y-4 shadow-sm " +
        "bg-white border-slate-200 " +
        "dark:bg-slate-900 dark:border-slate-700"
      }
      dir="rtl"
    >
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
        📦 ייבוא לוח מעבדות (Excel)
      </div>

      {/* Year identifiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            מזהה שנה (DB)
          </label>
          <input
            dir="ltr"
            className={inputCls}
            placeholder="tashpaz"
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1 text-slate-800 dark:text-slate-200">
            תווית שנה (לתצוגה)
          </label>
          <input
            className={inputCls}
            placeholder='תשפ״ז'
            value={yearLabel}
            onChange={(e) => setYearLabel(e.target.value)}
          />
        </div>
      </div>

      {/* Semester selection */}
      <div>
        <label className="text-sm font-semibold block mb-1 text-slate-800 dark:text-slate-200">
          סמסטר
        </label>
        <div className="relative">
          <select
            className={selectCls}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            <option value="">בחרי סמסטר</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                סמסטר {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* File input */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          type="button"
          onClick={chooseFile}
          className={
            "px-4 py-2 rounded-full border text-sm transition " +
            "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 " +
            "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
          }
        >
          📊 בחירת קובץ Excel
        </button>

        {file && (
          <span dir="ltr" className="text-xs text-slate-600 dark:text-slate-300">
            {file.name}
          </span>
        )}
      </div>

      {/* Upload button */}
      <button
        onClick={upload}
        disabled={loading}
        className={
          "px-5 py-2 rounded-xl font-semibold transition " +
          "bg-blue-600 text-white hover:bg-blue-700 " +
          "disabled:opacity-60 disabled:cursor-not-allowed " +
          "dark:bg-blue-500 dark:hover:bg-blue-600"
        }
      >
        {loading ? "מייבא..." : "⬆️ ייבוא לוח מעבדות"}
      </button>

      {/* Warning */}
      <div className="text-[11px] text-amber-700 dark:text-amber-300">
        ⚠️ Import overrides existing labs for the same year and semester.
      </div>

      {/* Status message */}
      {msg.text && (
        <div
          className={
            "text-sm font-semibold " +
            (msg.type === "error"
              ? "text-red-600 dark:text-red-300"
              : "text-green-600 dark:text-green-300")
          }
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
