import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * UploadYearbook.jsx
 * -------------------
 * Admin component for uploading a Yearbook (DOCX file).
 * Backend endpoint: POST /api/admin/upload/yearbook
 */
function sanitizeDisplayName(label) {
  return label.replace(/"/g, "״").replace(/'/g, "׳").trim();
}

export default function UploadYearbook() {
  const fileRef = useRef(null);

  const [yearbookId,    setYearbookId]    = useState("");
  const [yearbookLabel, setYearbookLabel] = useState("");
  const [file,          setFile]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState({ type: "", text: "" });

  const upload = async () => {
    if (!yearbookId || !yearbookLabel || !file) {
      setMsg({ type: "error", text: "יש למלא מזהה שנתון, שם תצוגה ולבחור קובץ DOCX" });
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
      try { data = JSON.parse(text); } catch { throw new Error("Server did not return valid JSON"); }
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setMsg({ type: "ok", text: "השנתון יובא ונשמר בהצלחה" });
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

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">ייבוא שנתון (DOCX)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="space-y-1.5">
          <Label htmlFor="yearbook-id">מזהה שנתון (טכני)</Label>
          <Input
            id="yearbook-id"
            dir="ltr"
            placeholder="shnaton_tashpaz"
            value={yearbookId}
            onChange={(e) => setYearbookId(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="yearbook-label">שם תצוגה לסטודנטים</Label>
          <Input
            id="yearbook-label"
            placeholder='תשפ"ז'
            value={yearbookLabel}
            onChange={(e) => setYearbookLabel(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
            בחירת קובץ DOCX
          </Button>
          {file && (
            <span dir="ltr" className="text-xs text-muted-foreground">{file.name}</span>
          )}
        </div>

        <Button onClick={upload} disabled={loading}>
          {loading ? "מייבא..." : "העלאת השנתון"}
        </Button>

        {msg.text && (
          <p className={`text-sm font-semibold ${
            msg.type === "error" ? "text-destructive" : "text-bio-green dark:text-bio-green-glow"
          }`}>
            {msg.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
