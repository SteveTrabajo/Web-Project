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

  // All catalog courses (code + name), for rendering relations and for the
  // "resolve to" course picker in the review list.
  const catalog = useMemo(() => {
    if (!preview) return [];
    return [...preview.semesters.flatMap((s) => s.courses), ...preview.unassigned].sort(
      (a, b) => (a.semesterNumber || 99) - (b.semesterNumber || 99) || a.courseCode.localeCompare(b.courseCode)
    );
  }, [preview]);

  const nameMap = useMemo(() => new Map(catalog.map((c) => [c.courseCode, c.courseName])), [catalog]);
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

  const assignUnassigned = (idx, sem) => {
    setPreview((p) => ({
      ...p,
      unassigned: p.unassigned.map((c, i) => (i === idx ? { ...c, semesterNumber: Number(sem) } : c)),
    }));
  };

  const patchUnresolved = (id, patch) => {
    setPreview((p) => ({
      ...p,
      unresolvedRelations: p.unresolvedRelations.map((u) => (u.id === id ? { ...u, ...patch } : u)),
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
        text: `נשמר בהצלחה: ${s.courses} קורסים, ${s.relations} קשרים, ${s.resolvedRelations} קשרים שהושלמו ידנית${
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

          <p className="text-caption text-muted-foreground">
            יש להעלות קובץ המכיל את טבלאות הקורסים לפי סמסטרים בלבד (עד 20 עמודים). עמודי מבוא, הערות
            וקורסי בחירה/התמחות אינם נדרשים ולא ייובאו.
          </p>

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
          {preview.stats.unresolvedRelations > 0 && (
            <Badge variant="destructive">{preview.stats.unresolvedRelations} קשרים לא זוהו</Badge>
          )}
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

        {/* Relations the AI could not resolve - optional manual fix */}
        {preview.unresolvedRelations?.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-body font-bold">קשרים שה-AI לא הצליח לזהות</h3>
            <p className="text-caption text-muted-foreground">
              עבור כל פריט ניתן לבחור את קורס הקדם/הצמוד הנכון כדי להוסיף את הקשר, או לסמן "התעלם".
              קשרים שלא יטופלו לא ייכתבו.
            </p>
            {preview.unresolvedRelations.map((u) => (
              <div key={u.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="text-caption">
                  <b>{relLabel(u.fromCode)}</b>
                  {u.semesterNumber ? <span className="text-muted-foreground"> · סמסטר {u.semesterNumber}</span> : null}
                </div>
                <div className="text-caption text-muted-foreground">
                  {u.reason === "dangling"
                    ? `הקוד ${u.rawText} מופיע כקשר אך אינו נמצא בין הקורסים שיובאו.`
                    : `טקסט שלא זוהה כקוד קורס: "${u.rawText}"`}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={u.resolvedTo || ""}
                    onValueChange={(v) => patchUnresolved(u.id, { resolvedTo: v, dismissed: false })}
                    disabled={u.dismissed}
                  >
                    <SelectTrigger className="w-64 h-8">
                      <span className="truncate">{u.resolvedTo ? relLabel(u.resolvedTo) : "בחר קורס קדם/צמוד"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {catalog
                        .filter((c) => c.courseCode !== u.fromCode)
                        .map((c) => (
                          <SelectItem key={c.courseCode} value={c.courseCode}>
                            {c.courseName} ({c.courseCode})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={u.resolvedType}
                    onValueChange={(v) => patchUnresolved(u.id, { resolvedType: v })}
                    disabled={u.dismissed}
                  >
                    <SelectTrigger className="w-28 h-8">
                      <span>{u.resolvedType === "COREQUISITE" ? "צמוד" : "קדם"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREREQUISITE">קדם</SelectItem>
                      <SelectItem value="COREQUISITE">צמוד</SelectItem>
                    </SelectContent>
                  </Select>

                  <label className="flex items-center gap-2 cursor-pointer text-caption">
                    <Checkbox checked={u.dismissed} onCheckedChange={() => patchUnresolved(u.id, { dismissed: !u.dismissed, resolvedTo: "" })} />
                    התעלם
                  </label>
                </div>
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
