import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "../utils/adminApi";

export default function AdvisorsTab({ toast }) {
  const [advisors, setAdvisors]           = useState([]);
  const [advisorDraft, setAdvisorDraft]   = useState(null);
  const [advisorSearch, setAdvisorSearch] = useState("");

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

  const newAdvisor = () =>
    setAdvisorDraft({ id: "", name: "", email: "", lastNameRanges: ["א-ת"], semesters: [1], tracks: ["כללי"] });

  const editAdvisor = (a) => setAdvisorDraft({ ...a });

  const saveAdvisor = async () => {
    try {
      if (!advisorDraft?.id) return toast("error", "חובה להזין ID ליועץ.");
      await apiFetch(`/api/admin/advisors/${encodeURIComponent(advisorDraft.id)}`, {
        method: "POST",
        body: advisorDraft,
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
            <h2 className="text-lg font-bold">יועצים</h2>
            <div className="flex gap-2 flex-wrap">
              <Input
                className="w-60 h-8 text-xs rounded-full"
                placeholder="חיפוש לפי שם / מייל..."
                value={advisorSearch}
                onChange={(e) => setAdvisorSearch(e.target.value)}
              />
              <Button size="sm" onClick={newAdvisor}>+ יועץ חדש</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
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
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label>טווח אותיות (lastNameRanges)</Label>
                <Input
                  value={(advisorDraft.lastNameRanges || []).join(", ")}
                  onChange={(e) =>
                    setAdvisorDraft((p) => ({
                      ...p,
                      lastNameRanges: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">דוגמה: "א-כ" או "א-ת"</p>
              </div>

              <div className="space-y-1.5">
                <Label>סמסטרים</Label>
                <Input
                  value={(advisorDraft.semesters || []).join(",")}
                  onChange={(e) =>
                    setAdvisorDraft((p) => ({
                      ...p,
                      semesters: e.target.value.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n)),
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">דוגמה: "1,2" או "5,6,7,8"</p>
              </div>

              <div className="space-y-1.5">
                <Label>מסלולים</Label>
                <Input
                  value={(advisorDraft.tracks || []).join(", ")}
                  onChange={(e) =>
                    setAdvisorDraft((p) => ({
                      ...p,
                      tracks: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                    }))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 justify-start">
            <Button onClick={saveAdvisor}>שמירה</Button>
            <Button variant="outline" onClick={() => setAdvisorDraft(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
