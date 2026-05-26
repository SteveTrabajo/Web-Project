import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import UploadLabs from "../../UploadLabs.jsx";
import { apiFetch } from "../utils/adminApi";

const EMPTY_LAB = {
  id: "", type: "", date: "", day: "", time: "", labGroup: "", lecturer: "",
};
const LAB_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const TBL_INPUT =
  "h-7 text-xs px-2 rounded border border-input bg-background text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full";

export default function LabsTab({ toast }) {
  const [labYears, setLabYears]           = useState([]);
  const [labSemesterId, setLabSemesterId] = useState("2");
  const [labYearbookId, setLabYearbookId] = useState("");
  const [labDoc, setLabDoc]               = useState({ yearbookId: "", semester: "", labs: [] });
  const [labLoading, setLabLoading]       = useState(false);

  const normalizeLab = (lab = {}, courseCode = "", courseName = "") => ({
    ...EMPTY_LAB,
    courseCode,
    type: lab.session || courseName,
    date: lab.date ? lab.date.split("T")[0] : "",
    day: lab.day || "",
    time: lab.time || "",
    labGroup: lab.group ?? "",
    lecturer: Array.isArray(lab.staff) ? lab.staff.join(", ") : lab.staff || "",
  });

  const loadLab = async () => {
    if (!labYearbookId) return;
    setLabLoading(true);
    toast("idle", "טוען לוח מעבדה...");
    try {
      const data = await apiFetch(
        `/api/admin/labs/${encodeURIComponent(labYearbookId)}/${encodeURIComponent(labSemesterId)}`
      );
      const semesterDoc = data?.doc || {};
      let labs = [];
      if (semesterDoc.courses && typeof semesterDoc.courses === "object") {
        Object.entries(semesterDoc.courses).forEach(([courseCode, course]) => {
          const courseName = course.courseName || "";
          if (Array.isArray(course.labs)) {
            course.labs.forEach((lab) => labs.push(normalizeLab(lab, courseCode, courseName)));
          }
        });
      }
      setLabDoc({ yearbookId: labYearbookId, semester: labSemesterId, labs });
      toast("ok", `נטענו ${labs.length} שורות מעבדה.`);
    } catch (e) {
      toast("error", e.message);
      setLabDoc({ yearbookId: labYearbookId, semester: labSemesterId, labs: [] });
    } finally {
      setLabLoading(false);
    }
  };

  useEffect(() => {
    async function loadLabYears() {
      try {
        const data = await apiFetch("/api/labs-years");
        setLabYears(data.years || []);
        if (!labYearbookId && data.years?.length) setLabYearbookId(data.years[0].id);
      } catch {
        toast("error", "לא ניתן לטעון שנות מעבדה");
      }
    }
    loadLabYears();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (labYearbookId) loadLab();
  }, [labYearbookId, labSemesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLab = async () => {
    try {
      const existing = await apiFetch(`/api/admin/labs/${labYearbookId}/${labSemesterId}`);
      const semesterDoc = existing?.doc || {};
      const coursesMap = { ...(semesterDoc.courses || {}) };
      Object.values(coursesMap).forEach((c) => { c.labs = []; });
      labDoc.labs.forEach((lab) => {
        if (!lab.courseCode || !coursesMap[lab.courseCode]) return;
        coursesMap[lab.courseCode].labs.push({
          session: lab.session || lab.type,
          group: lab.labGroup,
          date: lab.date,
          day: lab.day,
          time: lab.time,
          staff: lab.lecturer ? lab.lecturer.split(",").map((s) => s.trim()) : [],
        });
      });
      await apiFetch(`/api/admin/labs/${labYearbookId}/${labSemesterId}`, {
        method: "PUT",
        body: { courses: coursesMap },
      });
      toast("ok", "לוח המעבדות נשמר בהצלחה");
      loadLab();
    } catch (e) {
      toast("error", e.message);
    }
  };

  const updateLab = (index, field, value) => {
    const copy = [...labDoc.labs];
    copy[index] = { ...copy[index], [field]: value };
    setLabDoc({ ...labDoc, labs: copy });
  };
  const addLabRow    = () => setLabDoc({ ...labDoc, labs: [...labDoc.labs, { ...EMPTY_LAB }] });
  const removeLabRow = (i) => setLabDoc({ ...labDoc, labs: labDoc.labs.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <UploadLabs onUploadSuccess={loadLab} />

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-heading">עריכת לוחות מעבדה</h2>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={loadLab}>רענון</Button>
              <Button
                size="sm"
                className="bg-bio-green dark:bg-bio-green-glow dark:text-brand-navy-deep hover:opacity-90"
                onClick={saveLab}
              >
                שמירת כל השינויים
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 bg-muted/40 p-3 rounded-xl border border-border">
            <div className="space-y-1.5">
              <Label>שנתון</Label>
              <Select value={labYearbookId} onValueChange={setLabYearbookId}>
                <SelectTrigger dir="rtl"><SelectValue placeholder="בחרי שנה" /></SelectTrigger>
                <SelectContent>
                  {labYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>סמסטר</Label>
              <Select value={labSemesterId} onValueChange={setLabSemesterId}>
                <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LAB_SEMESTERS.map((s) => (
                    <SelectItem key={s} value={String(s)}>סמסטר {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {labLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">טוען נתוני מעבדות...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b-2 border-border">
                    <th className="p-2 text-right w-24">קוד קורס*</th>
                    <th className="p-2 text-right">סוג / שם</th>
                    <th className="p-2 text-right w-32">תאריך</th>
                    <th className="p-2 text-right w-12">יום</th>
                    <th className="p-2 text-right w-20">שעה</th>
                    <th className="p-2 text-right w-16">קבוצה</th>
                    <th className="p-2 text-right">מרצה/סגל</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {labDoc.labs.length ? (
                    labDoc.labs.map((lab, i) => (
                      <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-1"><input className={`${TBL_INPUT} font-mono`} value={lab.courseCode || ""} placeholder="קוד" onChange={(e) => updateLab(i, "courseCode", e.target.value)} /></td>
                        <td className="p-1"><input className={TBL_INPUT} value={lab.type || ""} placeholder="בטיחות..." onChange={(e) => updateLab(i, "type", e.target.value)} /></td>
                        <td className="p-1"><input className={`${TBL_INPUT} font-mono`} value={lab.date || ""} placeholder="DD/MM/YYYY" onChange={(e) => updateLab(i, "date", e.target.value)} /></td>
                        <td className="p-1"><input className={`${TBL_INPUT} text-center`} value={lab.day} placeholder="א'" onChange={(e) => updateLab(i, "day", e.target.value)} /></td>
                        <td className="p-1"><input className={`${TBL_INPUT} font-mono`} value={lab.time} placeholder="HH:mm" onChange={(e) => updateLab(i, "time", e.target.value)} /></td>
                        <td className="p-1"><input className={`${TBL_INPUT} text-center`} value={lab.labGroup} placeholder="1" onChange={(e) => updateLab(i, "labGroup", e.target.value)} /></td>
                        <td className="p-1"><input className={TBL_INPUT} value={lab.lecturer} placeholder="שמות מרצים..." onChange={(e) => updateLab(i, "lecturer", e.target.value)} /></td>
                        <td className="p-1 text-center">
                          <button onClick={() => removeLabRow(i)} className="text-destructive hover:opacity-70 p-1" title="מחק שורה">🗑</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                        אין נתונים להצגה. לחצי על "הוספת שורה" כדי להתחיל.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Button size="sm" variant="outline" onClick={addLabRow}>+ הוספת שורה חדשה</Button>
            <p className="text-[10px] text-muted-foreground italic">* קוד קורס חייב להתאים לקורס קיים בשנתון</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
