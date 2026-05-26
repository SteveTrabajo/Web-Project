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

/**
 * UploadLabs.jsx
 * ---------------
 * Admin component for uploading lab schedules from an Excel file.
 * Backend endpoint: POST /api/admin/upload/labs
 */
export default function UploadLabs() {
  const fileRef = useRef(null);

  const [yearId,    setYearId]    = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [semester,  setSemester]  = useState("");
  const [file,      setFile]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState({ type: "", text: "" });

  const upload = async () => {
    if (!yearId || !yearLabel || !semester || !file) {
      setMsg({ type: "error", text: "יש למלא שנה, סמסטר ולבחור קובץ Excel" });
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

      const token = JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token;
      const res = await fetch(`${API_BASE}/api/admin/upload/labs`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setMsg({ type: "ok", text: "לוח המעבדות יובא בהצלחה" });
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="year-label">תווית שנה (לתצוגה)</Label>
            <Input
              id="year-label"
              placeholder='תשפ״ז'
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>סמסטר</Label>
          <Select value={semester} onValueChange={setSemester}>
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
          <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
            בחירת קובץ Excel
          </Button>
          {file && (
            <span dir="ltr" className="text-caption text-muted-foreground">{file.name}</span>
          )}
        </div>

        <Button onClick={upload} disabled={loading}>
          {loading ? "מייבא..." : "ייבוא לוח מעבדות"}
        </Button>

        <p className="text-caption text-amber-700 dark:text-amber-300">
          Import overrides existing labs for the same year and semester.
        </p>

        {msg.text && (
          <p className={`text-body font-semibold ${
            msg.type === "error" ? "text-destructive" : "text-bio-green dark:text-bio-green-glow"
          }`}>
            {msg.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
