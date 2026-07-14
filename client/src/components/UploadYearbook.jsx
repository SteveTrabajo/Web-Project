import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

function sanitizeDisplayName(label) {
  return label.replace(/"/g, "״").replace(/'/g, "׳").trim();
}

function authHeader() {
  const token = JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const confidenceVariant = { high: "default", medium: "secondary", low: "outline" };

export default function UploadYearbook() {
  const fileRef = useRef(null);

  const [step, setStep] = useState("upload"); // "upload" | "review"
  const [yearbookId, setYearbookId] = useState("");
  const [yearbookLabel, setYearbookLabel] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [importId, setImportId] = useState(null);
  const [preview, setPreview] = useState(null);

  // code -> name across every course in the preview, for rendering relations.
  const nameMap = useMemo(() => {
    const m = new Map();
    if (!preview) return m;
    [...preview.semesters.flatMap((s) => s.courses), ...preview.unassigned].forEach((c) =>
      m.set(c.courseCode, c.courseName)
    );
    return m;
  }, [preview]);

  const relLabel = (code) => `${nameMap.get(code) || code} (${code})`;

  const upload = async () => {
    if (!yearbookId || !yearbookLabel || !file) {
      setMsg({ type: "error", text: "יש למלא מזהה שנתון, שם תצוגה ולבחור קובץ DOCX או PDF" });
      return;
    }
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const form = new FormData();
      form.append("yearbookId", yearbookId);
      form.append("yearbookLabel", sanitizeDisplayName(yearbookLabel));
      form.append("file", file);

      const res = await fetch(`${API_BASE}/api/admin/upload/yearbook`, {
        method: "POST",
        headers: authHeader(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setImportId(data.importId);
      setPreview(data.preview);
      setStep("review");
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleSuggestion = (id) => {
    setPreview((p) => ({
      ...p,
      suggestions: p.suggestions.map((s) => (s.id === id ? { ...s, approved: !s.approved } : s)),
    }));
  };

  const assignUnassigned = (idx, sem) => {
    setPreview((p) => ({
      ...p,
      unassigned: p.unassigned.map((c, i) => (i === idx ? { ...c, semesterNumber: Number(sem) } : c)),
    }));
  };

  const commit = async () => {
    const stillUnplaced = (preview.unassigned || []).some((c) => !Number.isInteger(c.semesterNumber));
    if (stillUnplaced) {
      setMsg({ type: "error", text: "יש לשייך סמסטר לכל הקורסים הלא-משויכים לפני השמירה" });
      return;
    }
    setCommitting(true);
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API_BASE}/api/admin/upload/yearbook/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ importId, preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Commit failed");

      const s = data.stats;
      resetAll();
      setMsg({
        type: "ok",
        text: `נשמר בהצלחה: ${s.courses} קורסים, ${s.relations} קשרים, ${s.appliedSuggestions} הצעות אושרו${
          s.cycles ? ` (אזהרה: ${s.cycles} מעגלי קדם זוהו)` : ""
        }`,
      });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setCommitting(false);
    }
  };

  const resetAll = () => {
    setStep("upload");
    setPreview(null);
    setImportId(null);
    setFile(null);
    setYearbookId("");
    setYearbookLabel("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // -------- Upload step --------
  if (step === "upload") {
    return (
      <Card dir="rtl">
        <CardHeader className="pb-3">
          <CardTitle className="text-heading">ייבוא שנתון (DOCX או PDF)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="yearbook-id">מזהה שנתון (טכני)</Label>
            <Input id="yearbook-id" dir="ltr" placeholder="shnaton_tashpaz" value={yearbookId} onChange={(e) => setYearbookId(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="yearbook-label">שם תצוגה לסטודנטים</Label>
            <Input id="yearbook-label" placeholder='תשפ"ז' value={yearbookLabel} onChange={(e) => setYearbookLabel(e.target.value)} />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input ref={fileRef} type="file" accept=".docx,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
              בחירת קובץ
            </Button>
            {file && <span dir="ltr" className="text-caption text-muted-foreground">{file.name}</span>}
          </div>

          <Button onClick={upload} disabled={loading}>
            {loading ? "מנתח את הקובץ..." : "ניתוח וייבוא"}
          </Button>

          {msg.text && (
            <p className={`text-body font-semibold ${msg.type === "error" ? "text-destructive" : "text-bio-green dark:text-bio-green-glow"}`}>
              {msg.text}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // -------- Review step --------
  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-heading">סקירת ייבוא - {preview.label || preview.yearbookId}</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="secondary">{preview.stats.totalCourses} קורסים</Badge>
          <Badge variant="secondary">{preview.stats.semesters} סמסטרים</Badge>
          <Badge variant="outline">פורמט: {preview.format?.toUpperCase()}</Badge>
          {preview.stats.suggestions > 0 && <Badge>{preview.stats.suggestions} הצעות AI</Badge>}
          {preview.stats.anomalies > 0 && <Badge variant="destructive">{preview.stats.anomalies} חריגות</Badge>}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Warnings */}
        {preview.warnings?.length > 0 && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-caption text-amber-700 dark:text-amber-300 space-y-1">
            {preview.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
          </div>
        )}

        {/* Unassigned courses - must resolve before commit */}
        {preview.unassigned?.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-body font-bold text-destructive">קורסים ללא סמסטר - יש לשייך</h3>
            {preview.unassigned.map((c, idx) => (
              <div key={c.courseCode} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                <span className="text-caption">{c.courseName} ({c.courseCode})</span>
                <Select value={c.semesterNumber ? String(c.semesterNumber) : ""} onValueChange={(v) => assignUnassigned(idx, v)}>
                  <SelectTrigger className="w-32 h-8"><span>{c.semesterNumber ? `סמסטר ${c.semesterNumber}` : "בחר סמסטר"}</span></SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map((s) => <SelectItem key={s} value={String(s)}>סמסטר {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </section>
        )}

        {/* AI suggestions - approve to include */}
        {preview.suggestions?.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-body font-bold">הצעות קשרים מ-AI (אשר/י כדי לכלול)</h3>
            <p className="text-caption text-muted-foreground">הצעות אלו אינן נכללות אלא אם תאשר/י אותן - הבוט עונה רק על סמך מידע מאושר.</p>
            {preview.suggestions.map((s) => (
              <label key={s.id} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <Checkbox checked={s.approved} onCheckedChange={() => toggleSuggestion(s.id)} className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="text-caption">
                    <b>{relLabel(s.from)}</b>{" "}
                    {s.type === "COREQUISITE" ? "צמוד ל־" : "דורש קדם"}{" "}
                    <b>{relLabel(s.to)}</b>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={confidenceVariant[s.confidence]}>{s.confidence}</Badge>
                    <span className="text-caption text-muted-foreground">{s.reason}</span>
                  </div>
                </div>
              </label>
            ))}
          </section>
        )}

        {/* Anomalies - informational */}
        {preview.anomalies?.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-body font-bold">חריגות שזוהו</h3>
            {preview.anomalies.map((a, i) => (
              <div key={i} className="text-caption text-muted-foreground rounded-lg border border-border p-2">
                <b>{a.name} ({a.code})</b> - {a.issue}
              </div>
            ))}
          </section>
        )}

        <Separator />

        {/* Detected courses per semester (read-only) */}
        <section className="space-y-3">
          <h3 className="text-body font-bold">קורסים שזוהו</h3>
          {preview.semesters.map((sem) => (
            <div key={sem.semesterNumber} className="space-y-1">
              <div className="text-caption font-bold text-bio-green dark:text-bio-green-glow">סמסטר {sem.semesterNumber}</div>
              <div className="space-y-1">
                {sem.courses.map((c) => (
                  <div key={c.courseCode} className="rounded-lg border border-border p-2 text-caption">
                    <div className="font-semibold">{c.courseName} ({c.courseCode}){c.credits != null ? ` · ${c.credits} נ"ז` : ""}</div>
                    {c.prerequisites?.length > 0 && (
                      <div className="text-muted-foreground mt-0.5">קדם: {c.prerequisites.map(relLabel).join(", ")}</div>
                    )}
                    {c.corequisites?.length > 0 && (
                      <div className="text-muted-foreground mt-0.5">צמוד: {c.corequisites.map(relLabel).join(", ")}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {msg.text && (
          <p className={`text-body font-semibold ${msg.type === "error" ? "text-destructive" : "text-bio-green dark:text-bio-green-glow"}`}>
            {msg.text}
          </p>
        )}

        <div className="flex gap-3">
          <Button onClick={commit} disabled={committing}>
            {committing ? "שומר..." : "אישור ושמירה"}
          </Button>
          <Button variant="outline" onClick={resetAll} disabled={committing}>
            ביטול
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
