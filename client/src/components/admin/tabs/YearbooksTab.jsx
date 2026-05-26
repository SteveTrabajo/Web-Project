import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import UploadYearbook from "../../UploadYearbook.jsx";
import { apiFetch } from "../utils/adminApi";

const TBL_INPUT =
  "h-7 text-caption px-2 rounded border border-input bg-background text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full";
const TBL_SELECT =
  "h-7 text-caption px-2 rounded border border-input bg-background text-foreground w-full outline-none focus:ring-1 focus:ring-ring";

export default function YearbooksTab({ toast }) {
  const [yearbooks, setYearbooks]     = useState([]);
  const [ybId, setYbId]               = useState("");
  const [semId, setSemId]             = useState("semester_1");
  const [courses, setCourses]         = useState([]);
  const [courseDraft, setCourseDraft] = useState(null);

  const loadYearbooks = async () => {
    try {
      const data = await apiFetch("/api/yearbooks");
      setYearbooks(data.yearbooks || []);
      if (!ybId && data.yearbooks?.length) setYbId(data.yearbooks[0].id);
    } catch (e) {
      toast("error", e.message);
    }
  };

  const loadCourses = async () => {
    if (!ybId || !semId) return;
    toast("idle", "טוען קורסים...");
    try {
      const data = await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(ybId)}/requiredCourses/${encodeURIComponent(semId)}/courses`
      );
      setCourses(data.courses || []);
      toast("ok", `נטענו ${data.courses?.length || 0} קורסים.`);
    } catch (e) {
      toast("error", e.message);
    }
  };

  useEffect(() => { loadYearbooks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadCourses(); }, [ybId, semId]); // eslint-disable-line react-hooks/exhaustive-deps

  const newCourse = () =>
    setCourseDraft({ courseCode: "", courseName: "", lectureHours: null, practiceHours: null, labHours: null, credits: null, relations: [] });

  const editCourse = (c) =>
    setCourseDraft({
      courseCode: c.courseCode || c.id || "",
      courseName: c.courseName || "",
      lectureHours: c.lectureHours ?? null,
      practiceHours: c.practiceHours ?? null,
      labHours: c.labHours ?? null,
      credits: c.credits ?? null,
      relations: Array.isArray(c.relations) ? c.relations : [],
    });

  const saveCourse = async () => {
    try {
      if (!courseDraft?.courseCode) return toast("error", "חובה להזין קוד קורס.");
      await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(ybId)}/requiredCourses/${encodeURIComponent(semId)}/courses/${encodeURIComponent(courseDraft.courseCode)}`,
        { method: "PUT", body: courseDraft }
      );
      toast("ok", "הקורס נשמר.");
      setCourseDraft(null);
      loadCourses();
    } catch (e) {
      toast("error", e.message);
    }
  };

  const deleteCourse = async (courseCode) => {
    if (!confirm("למחוק קורס? (כולל relations)")) return;
    try {
      await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(ybId)}/requiredCourses/${encodeURIComponent(semId)}/courses/${encodeURIComponent(courseCode)}`,
        { method: "DELETE" }
      );
      toast("ok", "הקורס נמחק.");
      loadCourses();
    } catch (e) {
      toast("error", e.message);
    }
  };

  const addRelation = () =>
    setCourseDraft((p) => ({
      ...p,
      relations: [...(p.relations || []), { courseCode: "", courseName: "", type: "PREREQUISITE" }],
    }));

  const updateRelation = (index, field, value) =>
    setCourseDraft((p) => {
      const copy = [...(p.relations || [])];
      copy[index] = { ...copy[index], [field]: value };
      return { ...p, relations: copy };
    });

  const removeRelation = (index) =>
    setCourseDraft((p) => ({ ...p, relations: p.relations.filter((_, i) => i !== index) }));

  const closeDialog = (open) => { if (!open) setCourseDraft(null); };

  return (
    <div className="space-y-4">
      <UploadYearbook />

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-heading">שנתון / קורסי חובה</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadCourses}>רענון</Button>
              <Button size="sm" onClick={newCourse}>+ קורס חדש</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1.5">
              <Label>שנתון</Label>
              <Select value={ybId} onValueChange={setYbId}>
                <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearbooks.map((y) => (
                    <SelectItem key={y.id} value={y.id}>{y.label || y.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>סמסטר</Label>
              <Select value={semId} onValueChange={setSemId}>
                <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const key = `semester_${i + 1}`;
                    return <SelectItem key={key} value={key}>{key}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-right py-2 whitespace-nowrap">קוד</th>
                  <th className="text-right py-2 whitespace-nowrap">שם קורס</th>
                  <th className="text-right py-2 whitespace-nowrap">שעות</th>
                  <th className="text-right py-2 whitespace-nowrap">נ"ז</th>
                  <th className="text-right py-2">Relations</th>
                  <th className="text-right py-2 whitespace-nowrap">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.courseCode} className="border-b border-border last:border-b-0">
                    <td className="py-2 font-mono whitespace-nowrap">{c.courseCode}</td>
                    <td className="py-2">{c.courseName}</td>
                    <td className="py-2 whitespace-nowrap">ה:{c.lectureHours ?? "-"} · ת:{c.practiceHours ?? "-"} · מ:{c.labHours ?? "-"}</td>
                    <td className="py-2 whitespace-nowrap">{c.credits ?? "-"}</td>
                    <td className="py-2 text-caption text-muted-foreground">
                      {(c.relations || []).length
                        ? (c.relations || []).map((r) => `${r.type === "PREREQUISITE" ? "קדם" : "צמוד"}: ${r.courseCode}`).join(" | ")
                        : "-"}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => editCourse(c)}>עריכה</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteCourse(c.courseCode)}>מחיקה</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!courses.length && (
                  <tr><td className="py-3 text-muted-foreground" colSpan={6}>אין קורסים להצגה</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!courseDraft} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{courseDraft?.courseCode ? "עריכת קורס" : "קורס חדש"}</DialogTitle>
          </DialogHeader>
          {courseDraft && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>קוד קורס (חובה)</Label>
                  <Input
                    className="font-mono"
                    value={courseDraft.courseCode}
                    placeholder="41012"
                    onChange={(e) => setCourseDraft((p) => ({ ...p, courseCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>שם קורס</Label>
                  <Input
                    value={courseDraft.courseName}
                    onChange={(e) => setCourseDraft((p) => ({ ...p, courseName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "lectureHours",  label: "שעות הרצאה" },
                  { key: "practiceHours", label: "שעות תרגול" },
                  { key: "labHours",      label: "שעות מעבדה" },
                  { key: "credits",       label: 'נ"ז' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      value={courseDraft[key] ?? ""}
                      onChange={(e) =>
                        setCourseDraft((p) => ({ ...p, [key]: e.target.value === "" ? null : Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Relations</Label>
                  <Button size="sm" variant="outline" onClick={addRelation}>+ הוספה</Button>
                </div>
                {(courseDraft.relations || []).length === 0 && (
                  <p className="text-caption text-muted-foreground">אין relations</p>
                )}
                {(courseDraft.relations || []).map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      className={`${TBL_SELECT} col-span-3`}
                      value={r.type}
                      onChange={(e) => updateRelation(i, "type", e.target.value)}
                    >
                      <option value="PREREQUISITE">קדם</option>
                      <option value="COREQUISITE">צמוד</option>
                    </select>
                    <input className={`${TBL_INPUT} col-span-3 font-mono`} placeholder="קוד" value={r.courseCode} onChange={(e) => updateRelation(i, "courseCode", e.target.value)} />
                    <input className={`${TBL_INPUT} col-span-4`} placeholder="שם" value={r.courseName} onChange={(e) => updateRelation(i, "courseName", e.target.value)} />
                    <Button size="sm" variant="destructive" className="col-span-2 h-7 text-caption px-2" onClick={() => removeRelation(i)}>🗑</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 justify-start">
            <Button onClick={saveCourse}>שמירה</Button>
            <Button variant="outline" onClick={() => setCourseDraft(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
