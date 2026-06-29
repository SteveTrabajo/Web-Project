import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "../utils/adminApi";

const parseList = (s) => String(s).split(",").map((x) => x.trim()).filter(Boolean);

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
// Must match the track names the bot sends (TRACKS in Bot.jsx).
const TRACKS = ["מולקולרית-תרופתית", "מזון והסביבה"];
const GENERAL_TRACK = "כללי";
const TRACK_FROM_SEMESTER = 5; // tracks only matter from semester 5 onward

const toggleValue = (arr, val) =>
  arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

export default function AdvisorsTab({ toast }) {
  const [advisors, setAdvisors]           = useState([]);
  const [advisorDraft, setAdvisorDraft]   = useState(null);
  const [advisorSearch, setAdvisorSearch] = useState("");
  // Raw text for the letter-range field, so typing "-" and "," isn't reformatted mid-edit.
  const [rangesText, setRangesText]       = useState("");
  // Original ID of the advisor being edited (null when creating), so its own ID isn't flagged as taken.
  const [editingId, setEditingId]         = useState(null);

  const semesters = advisorDraft?.semesters || [];
  const draftTracks = advisorDraft?.tracks || [];
  const needsTrack = semesters.some((n) => n >= TRACK_FROM_SEMESTER);
  const selectedTracks = draftTracks.filter((t) => TRACKS.includes(t));
  const fieldErrors = advisorDraft
    ? {
        id: !advisorDraft.id?.trim()
          ? "חובה להזין ID ליועץ."
          : advisors.some((a) => a.id === advisorDraft.id.trim() && a.id !== editingId)
          ? "כבר קיים יועץ עם ID זה."
          : null,
        name: !advisorDraft.name?.trim() ? "חובה להזין שם." : null,
        email: !advisorDraft.email?.trim()
          ? "חובה להזין מייל."
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(advisorDraft.email.trim())
          ? "כתובת מייל לא תקינה."
          : null,
      }
    : {};

  const formError = !advisorDraft
    ? null
    : fieldErrors.id ||
      fieldErrors.name ||
      fieldErrors.email ||
      (!semesters.length ? "יש לבחור לפחות סמסטר אחד." : null) ||
      (needsTrack && !selectedTracks.length ? "מסמסטר 5 ומעלה יש לבחור לפחות התמחות אחת." : null) ||
      null;

  const load = async () => {
    toast("idle", "טוען יועצים...");
    try {
      const data = await apiFetch("/api/admin/advisors");
      setAdvisors(data.advisors || []);
      toast("ok", `נטענו ${data.advisors?.length || 0} יועצים.`);
    } catch (e) {
      toast("error", e.message);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = advisorSearch.trim();
    if (!q) return advisors;
    return advisors.filter((a) =>
      [a.id, a.name, a.email, (a.tracks || []).join(" ")].join(" ").toLowerCase().includes(q.toLowerCase())
    );
  }, [advisors, advisorSearch]);

  const openDraft = (draft, editId = null) => {
    setAdvisorDraft(draft);
    setEditingId(editId);
    setRangesText((draft.lastNameRanges || []).join(", "));
  };

  const newAdvisor = () =>
    openDraft({ id: "", name: "", email: "", lastNameRanges: ["א-ת"], semesters: [1], tracks: [GENERAL_TRACK] });

  const editAdvisor = (a) => openDraft({ ...a }, a.id);

  const toggleSemester = (n) =>
    setAdvisorDraft((p) => ({ ...p, semesters: toggleValue(p.semesters || [], n).sort((a, b) => a - b) }));

  const toggleTrack = (t) =>
    setAdvisorDraft((p) => ({ ...p, tracks: toggleValue(p.tracks || [], t) }));

  const saveAdvisor = async () => {
    try {
      if (!advisorDraft?.id) return toast("error", "חובה להזין ID ליועץ.");
      if (formError) return toast("error", formError);
      const payload = {
        ...advisorDraft,
        lastNameRanges: parseList(rangesText),
        semesters,
        tracks: needsTrack ? selectedTracks : [GENERAL_TRACK],
      };
      await apiFetch(`/api/admin/advisors/${encodeURIComponent(advisorDraft.id)}`, {
        method: "POST",
        body: payload,
      });
      toast("ok", "היועץ נשמר.");
      setAdvisorDraft(null);
      load();
    } catch (e) {
      toast("error", e.message);
    }
  };

  const deleteAdvisor = async (id) => {
    if (!confirm("למחוק יועץ?")) return;
    try {
      await apiFetch(`/api/admin/advisors/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("ok", "היועץ נמחק.");
      load();
    } catch (e) {
      toast("error", e.message);
    }
  };

  const closeDialog = (open) => { if (!open) setAdvisorDraft(null); };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-heading">יועצים</h2>
            <div className="flex gap-2 flex-wrap">
              <Input
                className="w-60 h-8 text-caption rounded-full"
                placeholder="חיפוש לפי שם / מייל..."
                value={advisorSearch}
                onChange={(e) => setAdvisorSearch(e.target.value)}
              />
              <Button size="sm" onClick={newAdvisor}>+ יועץ חדש</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-right py-2 whitespace-nowrap">ID</th>
                  <th className="text-right py-2 whitespace-nowrap">שם</th>
                  <th className="text-right py-2 whitespace-nowrap">מייל</th>
                  <th className="text-right py-2 whitespace-nowrap">סמסטרים</th>
                  <th className="text-right py-2 whitespace-nowrap">מסלולים</th>
                  <th className="text-right py-2 whitespace-nowrap">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 font-mono whitespace-nowrap">{a.id}</td>
                    <td className="py-2 whitespace-nowrap">{a.name}</td>
                    <td className="py-2 whitespace-nowrap">{a.email}</td>
                    <td className="py-2 whitespace-nowrap">{(a.semesters || []).join(", ")}</td>
                    <td className="py-2">{(a.tracks || []).join(" / ")}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => editAdvisor(a)}>עריכה</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteAdvisor(a.id)}>מחיקה</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td className="py-3 text-muted-foreground" colSpan={6}>אין נתונים</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!advisorDraft} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{advisorDraft?.id ? "עריכת יועץ" : "יועץ חדש"}</DialogTitle>
          </DialogHeader>
          {advisorDraft && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {[
                { key: "id",    label: "ID (חובה)", placeholder: "ADVISOR_7" },
                { key: "name",  label: "שם" },
                { key: "email", label: "מייל" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={advisorDraft[key] ?? ""}
                    placeholder={placeholder}
                    onChange={(e) => setAdvisorDraft((p) => ({ ...p, [key]: e.target.value }))}
                    readOnly={key === "id" && editingId !== null}
                    className={key === "id" && editingId !== null ? "opacity-60 cursor-not-allowed" : ""}
                  />
                  <p className="text-caption text-destructive min-h-5">
                    {fieldErrors[key]}
                  </p>
                </div>
              ))}

              <div className="space-y-1.5">
                <Label>טווח אותיות (lastNameRanges)</Label>
                <Input
                  value={rangesText}
                  onChange={(e) => setRangesText(e.target.value)}
                />
                <p className="text-caption text-muted-foreground">דוגמה: "א-כ" או "א-ת". לכמה טווחים: "א-כ, ל-ת"</p>
              </div>

              <div className="space-y-1.5">
                <Label>סמסטרים</Label>
                <div className="flex flex-wrap gap-2">
                  {SEMESTERS.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant={semesters.includes(n) ? "default" : "outline"}
                      className="w-9"
                      onClick={() => toggleSemester(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <p className="text-caption text-destructive min-h-5">
                  {!semesters.length && "יש לבחור לפחות סמסטר אחד."}
                </p>
              </div>

              {needsTrack && (
                <div className="space-y-1.5">
                  <Label>התמחות (מסמסטר 5)</Label>
                  <div className="flex flex-wrap gap-2">
                    {TRACKS.map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={draftTracks.includes(t) ? "default" : "outline"}
                        onClick={() => toggleTrack(t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                  <p className="text-caption text-destructive min-h-5">
                    {!selectedTracks.length && "מסמסטר 5 ומעלה יש לבחור לפחות התמחות אחת."}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2 justify-start">
            <Button onClick={saveAdvisor} disabled={!!formError}>שמירה</Button>
            <Button variant="outline" onClick={() => setAdvisorDraft(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
