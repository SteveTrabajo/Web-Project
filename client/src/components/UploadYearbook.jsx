import { useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";


/**
 * UploadYearbook.jsx
 * -------------------
 * Admin component for uploading a Yearbook (DOCX file).
 *
 * Features:
 * - Accepts technical yearbook ID, display label, and DOCX file.
 * - Sanitizes label to avoid problematic quotation characters.
 * - Sends FormData to backend for parsing and storage.
 *
 * Backend endpoint:
 * - POST /api/admin/upload/yearbook
 
 */
function sanitizeDisplayName(label) {
  return label
    .replace(/"/g, "״")
    .replace(/'/g, "׳")
    .trim();
}

export default function UploadYearbook() {
  const fileRef = useRef(null);

  const [yearbookId, setYearbookId] = useState("");
  const [yearbookLabel, setYearbookLabel] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const chooseFile = () => {
    fileRef.current?.click();
  };

  /**
   * upload()
   * - Validates inputs.
   * - Sends DOCX yearbook file to backend.
   * - Resets form on success.
   */
  const upload = async () => {
    if (!yearbookId || !yearbookLabel || !file) {
      setMsg({
        type: "error",
        text: "יש למלא מזהה שנתון, שם תצוגה ולבחור קובץ DOCX",
      });
      return;
    }

    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      const form = new FormData();
      form.append("yearbookId", yearbookId);
      form.append("yearbookLabel", sanitizeDisplayName(yearbookLabel));
      form.append("file", file);

      const token = JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token;
      const res = await fetch(`${API_BASE}/api/admin/upload/yearbook`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("❌ Server did not return valid JSON");
      }

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setMsg({ type: "ok", text: "✅ השנתון יובא ונשמר בהצלחה" });

      // Reset form
      setFile(null);
      setYearbookId("");
      setYearbookLabel("");
      if (fileRef.current) fileRef.current.value = "";

    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border px-3 py-2 outline-none transition " +
    "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 " +
    "focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 " +
    "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 " +
    "dark:focus:ring-blue-400/25 dark:focus:border-blue-400";

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
        📦 ייבוא שנתון (DOCX)
      </div>

      {/* Yearbook ID */}
      <div>
        <label className="text-sm font-semibold block mb-1 text-slate-800 dark:text-slate-200">
          מזהה שנתון (טכני)
        </label>
        <input
          dir="ltr"
          className={inputCls}
          placeholder="shnaton_tashpaz"
          value={yearbookId}
          onChange={(e) => setYearbookId(e.target.value)}
        />
      </div>

      {/* Display Label */}
      <div>
        <label className="text-sm font-semibold block mb-1 text-slate-800 dark:text-slate-200">
          שם תצוגה לסטודנטים
        </label>
        <input
          className={inputCls}
          placeholder='תשפ"ז'
          value={yearbookLabel}
          onChange={(e) => setYearbookLabel(e.target.value)}
        />
      </div>

      {/* File Picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
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
          📄 בחירת קובץ DOCX
        </button>

        {file && (
          <span dir="ltr" className="text-xs text-slate-600 dark:text-slate-300">
            {file.name}
          </span>
        )}
      </div>

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
        {loading ? "מייבא..." : "⬆️ העלאת השנתון"}
      </button>

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
