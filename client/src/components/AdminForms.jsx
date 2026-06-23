import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
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
      {msg.text && (
        <div
          className={
            "text-body rounded-2xl border px-4 py-3 " +
            (msg.type === "error"
              ? "text-destructive bg-destructive/10 border-destructive/20"
              : "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20")
          }
        >
          {msg.text}
        </div>
      )}

      {/* Upload new form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="text-body font-semibold">העלאת טופס חדש</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-caption font-medium text-muted-foreground block mb-1">
                תווית תצוגה (אופציונלי)
              </label>
              <Input
                placeholder="למשל: טופס ייעוץ לסטודנט"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div>
              <label className="text-caption font-medium text-muted-foreground block mb-1">
                שימוש בבוט
              </label>
              <Select value={usage} onValueChange={setUsage}>
                <SelectTrigger dir="rtl" className="w-full">
                  <span>{USAGE_OPTIONS.find((o) => o.value === usage)?.label}</span>
                </SelectTrigger>
                <SelectContent>
                  {USAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button type="button" variant="outline" onClick={chooseFile}>
              📄 בחירת קובץ
            </Button>
            {file && (
              <span dir="ltr" className="text-caption text-muted-foreground">
                {file.name}
              </span>
            )}
            <Button type="button" onClick={upload} disabled={uploading}>
              {uploading ? "מעלה..." : "⬆️ העלאה"}
            </Button>
          </div>

          <div className="text-caption text-muted-foreground">
            מותר: doc, docx, pdf · מקסימום 10MB
          </div>
        </CardContent>
      </Card>

      {/* Forms list */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-heading">📄 טפסים לסטודנטים</h2>
            <Button size="sm" variant="outline" onClick={loadForms} disabled={loading}>
              {loading ? "טוען..." : "רענון"}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-caption font-medium text-muted-foreground block mb-1">
                חיפוש (שם קובץ או תווית)
              </label>
              <Input
                placeholder="הקלד לחיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[200px]">
              <label className="text-caption font-medium text-muted-foreground block mb-1">
                סינון לפי שימוש
              </label>
              <Select value={usageFilter} onValueChange={setUsageFilter}>
                <SelectTrigger dir="rtl" className="w-full">
                  <span>
                    {usageFilter === "all"
                      ? "כל השימושים"
                      : USAGE_OPTIONS.find((o) => o.value === usageFilter)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השימושים</SelectItem>
                  {USAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
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
                  <tr key={f.filename} className="border-b border-border last:border-b-0">
                    <td className="py-2 px-3 font-mono text-[11px] text-right" dir="ltr">
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
                          className="text-bio-green dark:text-bio-green-glow underline"
                        >
                          פתיחה
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteForm(f.filename)}
                          className="text-destructive hover:underline"
                        >
                          מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !filteredForms.length && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground">
                      {forms.length ? "לא נמצאו טפסים התואמים את הסינון" : "אין טפסים"}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground animate-pulse">
                      טוען...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
