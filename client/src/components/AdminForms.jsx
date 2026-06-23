import { useEffect, useRef, useState } from "react";
import { apiFetch, getAdminToken } from "./admin/utils/adminApi.js";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";

const USAGE_OPTIONS = [
  { value: "advisor", label: "טופס ייעוץ (advisor)" },
  { value: "exception_registration", label: "רישום/ביטול חריג (exception_registration)" },
  { value: "other", label: "אחר (other)" },
];

export default function AdminForms() {
  const fileRef = useRef(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [usage, setUsage] = useState("other");
  const [msg, setMsg] = useState({ type: "", text: "" });

  // table filters
  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState("all");

  const inputCls =
    "w-full rounded-xl border px-3 py-2 text-sm outline-none transition " +
    "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 " +
    "focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 " +
    "dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400";

  const loadForms = async () => {
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const data = await apiFetch("/api/admin/forms");
      setForms(data.forms || []);
    } catch (e) {
      setMsg({ type: "error", text: e.message });
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const chooseFile = () => fileRef.current?.click();

  const upload = async () => {
    if (!file) {
      setMsg({ type: "error", text: "יש לבחור קובץ להעלאה" });
      return;
    }

    setUploading(true);
    setMsg({ type: "", text: "" });

    try {
      const form = new FormData();
      form.append("file", file);
      if (label.trim()) form.append("label", label.trim());
      form.append("usage", usage);

      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/admin/forms/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "העלאה נכשלה");

      setMsg({ type: "ok", text: "✅ הטופס הועלה בהצלחה" });
      setFile(null);
      setLabel("");
      setUsage("other");
      if (fileRef.current) fileRef.current.value = "";
      await loadForms();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setUploading(false);
    }
  };

  const deleteForm = async (filename) => {
    if (!confirm(`למחוק את הטופס "${filename}"?`)) return;

    setMsg({ type: "", text: "" });
    try {
      await apiFetch(`/api/admin/forms/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      setMsg({ type: "ok", text: "🗑️ הטופס נמחק" });
      await loadForms();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  };

  const usageLabel = (value) =>
    USAGE_OPTIONS.find((o) => o.value === value)?.label || value;

  const formatDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("he-IL");
    } catch {
      return iso;
    }
  };

  const formatSize = (bytes) => {
    if (bytes == null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const q = search.trim().toLowerCase();
  const filteredForms = forms.filter((f) => {
    const matchesUsage = usageFilter === "all" || f.usage === usageFilter;
    const matchesSearch =
      !q ||
      (f.filename || "").toLowerCase().includes(q) ||
      (f.label || "").toLowerCase().includes(q);
    return matchesUsage && matchesSearch;
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-lg font-bold text-gray-800 dark:text-slate-100">
          📄 טפסים לסטודנטים
        </div>
        <button
          type="button"
          onClick={loadForms}
          disabled={loading}
          className="px-4 py-2 rounded-full text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
        >
          {loading ? "טוען..." : "רענון"}
        </button>
      </div>

      {msg.text && (
        <div
          className={
            "text-sm rounded-xl border px-4 py-3 " +
            (msg.type === "error"
              ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
              : "bg-green-50 border-green-200 text-green-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200")
          }
        >
          {msg.text}
        </div>
      )}

      <div className="border rounded-2xl p-4 space-y-4 bg-white dark:bg-slate-900 dark:border-slate-700">
        <div className="text-sm font-bold text-gray-800 dark:text-slate-100">
          העלאת טופס חדש
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-200 block mb-1">
              תווית תצוגה (אופציונלי)
            </label>
            <input
              className={inputCls}
              placeholder="למשל: טופס ייעוץ לסטודנט"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-200 block mb-1">
              שימוש בבוט
            </label>
            <select
              className={inputCls}
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
            >
              {USAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".doc,.docx,.pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={chooseFile}
            className="px-5 py-2 rounded-xl border text-sm font-semibold bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          >
            📄 בחירת קובץ
          </button>
          {file && (
            <span dir="ltr" className="text-xs text-slate-600 dark:text-slate-300">
              {file.name}
            </span>
          )}
          <button
            type="button"
            onClick={upload}
            disabled={uploading}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500"
          >
            {uploading ? "מעלה..." : "⬆️ העלאה"}
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          מותר: doc, docx, pdf · מקסימום 10MB
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-gray-700 dark:text-slate-200 block mb-1">
            חיפוש (שם קובץ או תווית)
          </label>
          <input
            className={inputCls}
            placeholder="הקלד לחיפוש..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="min-w-[200px]">
          <label className="text-xs font-semibold text-gray-700 dark:text-slate-200 block mb-1">
            סינון לפי שימוש
          </label>
          <select
            className={inputCls}
            value={usageFilter}
            onChange={(e) => setUsageFilter(e.target.value)}
          >
            <option value="all">כל השימושים</option>
            {USAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-2xl dark:border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600 border-b bg-slate-50 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800">
              <th className="text-right py-2 px-3">שם קובץ</th>
              <th className="text-right py-2 px-3">תווית</th>
              <th className="text-right py-2 px-3">שימוש</th>
              <th className="text-right py-2 px-3">גודל</th>
              <th className="text-right py-2 px-3">תאריך</th>
              <th className="text-right py-2 px-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredForms.map((f) => (
              <tr
                key={f.filename}
                className="border-b last:border-b-0 dark:border-slate-800"
              >
                <td className="py-2 px-3 font-mono text-[11px]" dir="ltr">
                  {f.filename}
                </td>
                <td className="py-2 px-3">{f.label || "—"}</td>
                <td className="py-2 px-3">{usageLabel(f.usage)}</td>
                <td className="py-2 px-3">{formatSize(f.size)}</td>
                <td className="py-2 px-3">{formatDate(f.uploadedAt)}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline dark:text-blue-300"
                    >
                      פתיחה
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteForm(f.filename)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      מחיקה
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !filteredForms.length && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-500 dark:text-slate-400">
                  {forms.length ? "לא נמצאו טפסים התואמים את הסינון" : "אין טפסים"}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-blue-600 animate-pulse">
                  טוען...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
