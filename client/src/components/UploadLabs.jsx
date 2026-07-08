import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const formatDate = (iso) => {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const formatDateRange = (lab) => {
  if (!lab.dateEnd) return formatDate(lab.date);
  const [y1, m1, d1] = String(lab.date).split("-");
  const [y2, m2, d2] = String(lab.dateEnd).split("-");
  if (!y2) return formatDate(lab.date);
  if (y1 === y2 && m1 === m2) return `${d1}-${d2}/${m1}/${y1}`;
  return `${d1}/${m1}-${d2}/${m2}/${y2}`;
};

/**
 * UploadLabs.jsx
 * ---------------
 * Admin component for uploading lab schedules from an Excel file.
 * Two-step flow: POST /api/admin/upload/labs parses the file (preview only),
 * the admin reviews all parsed rows, then confirm commits via
 * PUT /api/admin/labs/:yearbook/:semester.
 */
export default function UploadLabs({ onUploadSuccess }) {
  const fileRef = useRef(null);

  const [yearId,    setYearId]    = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [semester,  setSemester]  = useState("");
  const [file,      setFile]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState({ type: "", text: "" });
  const [preview,   setPreview]   = useState(null);

  const getToken = () =>
    JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token;

  const upload = async () => {
    if (!yearId || !yearLabel || !semester || !file) {
      setMsg({ type: "error", text: "יש למלא שנה, סמסטר ולבחור קובץ Excel" });
      return;
    }
    setLoading(true);
    setMsg({ type: "", text: "" });
    setPreview(null);
    try {
      const form = new FormData();
      form.append("yearId", yearId);
      form.append("yearLabel", yearLabel);
      form.append("semester", semester);
      form.append("file", file);

      const token = getToken();
      const res = await fetch(`${API_BASE}/api/admin/upload/labs`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (!data.courses || !data.report || data.report.totalCourses === 0) {
        throw new Error("לא זוהו קורסים בקובץ - יש לוודא שהקובץ במבנה הנכון");
      }

      setPreview({ report: data.report, courses: data.courses });
      setMsg({
        type: "ok",
        text: `נמצאו ${data.report.totalCourses} קורסים ו-${data.report.totalLabs} מפגשי מעבדה - יש לאשר לפני ייבוא`,
      });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/api/admin/labs/${encodeURIComponent(yearId)}/${encodeURIComponent(semester)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ yearLabel, courses: preview.courses }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setMsg({ type: "ok", text: "לוח המעבדות יובא בהצלחה" });
      setPreview(null);
      setFile(null);
      setYearId("");
      setYearLabel("");
      setSemester("");
      if (fileRef.current) fileRef.current.value = "";
      window.dispatchEvent(new Event("labs-updated"));
      onUploadSuccess?.();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const cancelImport = () => {
    setPreview(null);
    setMsg({ type: "", text: "" });
  };

  const issues = preview?.report?.quality?.rowsWithIssues || [];

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-heading">ייבוא לוח מעבדות (Excel)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="year-id">מזהה שנה (DB)</Label>
            <Input
              id="year-id"
              dir="ltr"
              placeholder="tashpaz"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              disabled={!!preview}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="year-label">תווית שנה (לתצוגה)</Label>
            <Input
              id="year-label"
              placeholder='תשפ״ז'
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              disabled={!!preview}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>סמסטר</Label>
          <Select value={semester} onValueChange={setSemester} disabled={!!preview}>
            <SelectTrigger dir="rtl">
              <SelectValue placeholder="בחרי סמסטר" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <SelectItem key={s} value={String(s)}>
                  סמסטר {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            variant="outline"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!preview}
          >
            בחירת קובץ Excel
          </Button>
          {file && (
            <span dir="ltr" className="text-caption text-muted-foreground">{file.name}</span>
          )}
        </div>

        {!preview && (
          <Button onClick={upload} disabled={loading}>
            {loading ? "מנתח..." : "ניתוח הקובץ לתצוגה מקדימה"}
          </Button>
        )}

        <p className="text-caption text-amber-700 dark:text-amber-300">
          הנתונים נשמרים רק לאחר אישור התצוגה המקדימה. האישור מחליף לוחות מעבדה קיימים עבור אותה שנה וסמסטר.
        </p>

        {msg.text && (
          <p className={`text-body font-semibold ${
            msg.type === "error" ? "text-destructive" : "text-bio-green dark:text-bio-green-glow"
          }`}>
            {msg.text}
          </p>
        )}

        {preview && (
          <div className="space-y-4">
            {issues.length > 0 && (
              <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1">
                <p className="text-body font-semibold text-amber-800 dark:text-amber-200">
                  שורות עם נתונים חסרים או לא תקינים:
                </p>
                {issues.map((row, i) => (
                  <p key={i} className="text-caption text-amber-800 dark:text-amber-200">
                    {row.courseName} ({row.courseCode}) - מעבדה {row.session || "?"}, קבוצה {row.group || "?"}: {row.missing.join(", ")}
                  </p>
                ))}
              </div>
            )}

            {Object.values(preview.courses).map((course) => (
              <div key={course.courseCode} className="space-y-1.5">
                <p className="text-body font-semibold">
                  {course.courseName} - {course.courseCode} ({course.labs.length} מפגשים)
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-caption">
                    <thead>
                      <tr className="bg-muted text-right">
                        <th className="p-2">מס' מע'</th>
                        <th className="p-2">תאריך</th>
                        <th className="p-2">יום</th>
                        <th className="p-2">שעה</th>
                        <th className="p-2">קבוצה</th>
                        <th className="p-2">מרצה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.labs.map((lab, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{lab.session}</td>
                          <td className="p-2" dir="ltr">{formatDateRange(lab)}</td>
                          <td className="p-2">{lab.day}</td>
                          <td className="p-2" dir="ltr">{lab.time}</td>
                          <td className="p-2">{lab.group}</td>
                          <td className="p-2">{(lab.staff || []).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3">
              <Button onClick={confirmImport} disabled={loading}>
                {loading ? "מייבא..." : "אישור וייבוא"}
              </Button>
              <Button variant="outline" onClick={cancelImport} disabled={loading}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
