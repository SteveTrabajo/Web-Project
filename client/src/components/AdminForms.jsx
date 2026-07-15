import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { apiFetch, getAdminToken } from "./admin/utils/adminApi.js";
import { FORM_CATEGORIES, categoryLabel } from "./formCategories.js";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";

// usage = the functional role the bot binds to (advisor / exception forms).
const USAGE_OPTIONS = [
  { value: "advisor", label: "טופס ייעוץ (advisor)" },
  { value: "exception_registration", label: "רישום/ביטול חריג (exception_registration)" },
  { value: "other", label: "אחר (other)" },
];

const usageLabelOf = (value) =>
  USAGE_OPTIONS.find((o) => o.value === value)?.label || value;

const EMPTY_DRAFT = { label: "", usage: "other", category: "general", keywords: "", description: "" };

export default function AdminForms() {
  const fileRef = useRef(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // upload form
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [usage, setUsage] = useState("other");
  const [category, setCategory] = useState("general");
  const [keywords, setKeywords] = useState("");
  const [description, setDescription] = useState("");

  // table filters
  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // inline edit
  const [editing, setEditing] = useState(null); // filename or null
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadForms = async () => {
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const data = await apiFetch("/api/admin/forms", { force: true });
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
      form.append("category", category);
      if (keywords.trim()) form.append("keywords", keywords.trim());
      if (description.trim()) form.append("description", description.trim());

      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/admin/forms/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "העלאה נכשלה");

      setMsg({ type: "ok", text: "✅ הקובץ הועלה בהצלחה" });
      setFile(null);
      setLabel("");
      setUsage("other");
      setCategory("general");
      setKeywords("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      await loadForms();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (f) => {
    setEditing(f.filename);
    setDraft({
      label: f.label || "",
      usage: f.usage || "other",
      category: f.category || "general",
      keywords: (f.keywords || []).join(", "),
      description: f.description || "",
    });
    setMsg({ type: "", text: "" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    setMsg({ type: "", text: "" });
    try {
      await apiFetch(`/api/admin/forms/${encodeURIComponent(editing)}`, {
        method: "PATCH",
        body: {
          label: draft.label,
          usage: draft.usage,
          category: draft.category,
          keywords: draft.keywords,
          description: draft.description,
        },
      });
      setMsg({ type: "ok", text: "✅ הפרטים עודכנו" });
      cancelEdit();
      await loadForms();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteForm = async (filename) => {
    if (!confirm(`למחוק את הקובץ "${filename}"?`)) return;

    setMsg({ type: "", text: "" });
    try {
      await apiFetch(`/api/admin/forms/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      setMsg({ type: "ok", text: "🗑️ הקובץ נמחק" });
      if (editing === filename) cancelEdit();
      await loadForms();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
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
    const matchesCategory = categoryFilter === "all" || (f.category || "general") === categoryFilter;
    const matchesSearch =
      !q ||
      (f.filename || "").toLowerCase().includes(q) ||
      (f.label || "").toLowerCase().includes(q) ||
      (f.keywords || []).some((k) => k.toLowerCase().includes(q));
    return matchesUsage && matchesCategory && matchesSearch;
  });

  // Shared category/usage/keywords/description field group (upload + edit).
  // Invoked as a function (not <MetaFields/>) so it splices into the parent tree
  // instead of mounting a new component that would drop input focus each render.
  const metaFields = (values, onChange, idPrefix) => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-caption font-medium text-muted-foreground block mb-1">תווית תצוגה</label>
          <Input
            placeholder="למשל: טופס בקשת פטור"
            value={values.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        <div>
          <label className="text-caption font-medium text-muted-foreground block mb-1">קטגוריה (נושא)</label>
          <Select value={values.category} onValueChange={(v) => onChange({ category: v })}>
            <SelectTrigger dir="rtl" className="w-full">
              <span>{categoryLabel(values.category)}</span>
            </SelectTrigger>
            <SelectContent>
              {FORM_CATEGORIES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-caption font-medium text-muted-foreground block mb-1">שימוש בבוט (תפקיד)</label>
          <Select value={values.usage} onValueChange={(v) => onChange({ usage: v })}>
            <SelectTrigger dir="rtl" className="w-full">
              <span>{usageLabelOf(values.usage)}</span>
            </SelectTrigger>
            <SelectContent>
              {USAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-caption font-medium text-muted-foreground block mb-1">
          מילות מפתח (מופרדות בפסיק) - עוזרות לבוט לזהות בקשות בשפה חופשית
        </label>
        <Input
          id={`${idPrefix}-keywords`}
          placeholder="למשל: פטור, הכרה בלימודים קודמים, זיכוי קורס"
          value={values.keywords}
          onChange={(e) => onChange({ keywords: e.target.value })}
        />
      </div>

      <div>
        <label className="text-caption font-medium text-muted-foreground block mb-1">תיאור קצר (אופציונלי)</label>
        <Input
          id={`${idPrefix}-description`}
          placeholder="מתי ולמה משתמשים בטופס"
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </>
  );

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

      {/* Upload new file */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="text-body font-semibold">העלאת קובץ חדש</div>

          {metaFields(
            { label, usage, category, keywords, description },
            (patch) => {
              if ("label" in patch) setLabel(patch.label);
              if ("usage" in patch) setUsage(patch.usage);
              if ("category" in patch) setCategory(patch.category);
              if ("keywords" in patch) setKeywords(patch.keywords);
              if ("description" in patch) setDescription(patch.description);
            },
            "upload"
          )}

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

      {/* Files list */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-heading">📄 קבצים לסטודנטים</h2>
            <Button size="sm" variant="outline" onClick={loadForms} disabled={loading}>
              {loading ? "טוען..." : "רענון"}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-caption font-medium text-muted-foreground block mb-1">
                חיפוש (שם, תווית או מילת מפתח)
              </label>
              <Input
                placeholder="הקלד לחיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[180px]">
              <label className="text-caption font-medium text-muted-foreground block mb-1">קטגוריה</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger dir="rtl" className="w-full">
                  <span>{categoryFilter === "all" ? "כל הקטגוריות" : categoryLabel(categoryFilter)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הקטגוריות</SelectItem>
                  {FORM_CATEGORIES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-caption font-medium text-muted-foreground block mb-1">שימוש</label>
              <Select value={usageFilter} onValueChange={setUsageFilter}>
                <SelectTrigger dir="rtl" className="w-full">
                  <span>{usageFilter === "all" ? "כל השימושים" : usageLabelOf(usageFilter)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השימושים</SelectItem>
                  {USAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inline edit panel */}
          {editing && (
            <div className="rounded-xl border border-bio-green/30 bg-bio-green/5 p-3 space-y-3">
              <div className="text-body font-semibold">
                עריכת קובץ: <span dir="ltr" className="font-mono text-caption">{editing}</span>
              </div>
              {metaFields(
                draft,
                (patch) => setDraft((d) => ({ ...d, ...patch })),
                "edit"
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? "שומר..." : "שמירה"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                  ביטול
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-right py-2 px-3">תווית</th>
                  <th className="text-right py-2 px-3">קטגוריה</th>
                  <th className="text-right py-2 px-3">מילות מפתח</th>
                  <th className="text-right py-2 px-3">שימוש</th>
                  <th className="text-right py-2 px-3">גודל</th>
                  <th className="text-right py-2 px-3">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((f) => (
                  <tr key={f.filename} className="border-b border-border last:border-b-0 align-top">
                    <td className="py-2 px-3">
                      <div className="font-semibold">{f.label || "—"}</div>
                      <div dir="ltr" className="font-mono text-[10px] text-muted-foreground">{f.filename}</div>
                    </td>
                    <td className="py-2 px-3">{categoryLabel(f.category)}</td>
                    <td className="py-2 px-3 max-w-[220px]">
                      {f.keywords?.length ? (
                        <span className="text-muted-foreground">{f.keywords.join(", ")}</span>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3">{usageLabelOf(f.usage)}</td>
                    <td className="py-2 px-3">{formatSize(f.size)}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2 flex-wrap">
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-bio-green dark:text-bio-green-glow underline">
                          פתיחה
                        </a>
                        <button type="button" onClick={() => startEdit(f)} className="text-brand-navy dark:text-blue-300 hover:underline">
                          עריכה
                        </button>
                        <button type="button" onClick={() => deleteForm(f.filename)} className="text-destructive hover:underline">
                          מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !filteredForms.length && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground">
                      {forms.length ? "לא נמצאו קבצים התואמים את הסינון" : "אין קבצים"}
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
