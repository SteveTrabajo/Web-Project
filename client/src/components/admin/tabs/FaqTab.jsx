import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "../utils/adminApi";

function shortDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function AnswerCard({ item, yearbookLabel, onEdit, onToggle, onDelete }) {
  const published = item.status === "published";
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={published ? "default" : "secondary"} className="text-caption">
            {published ? "פורסם" : "טיוטה"}
          </Badge>
          <Badge variant="outline" className="text-caption">
            {item.yearbook ? `שנתון ${yearbookLabel || item.yearbook}` : "כל השנתונים"}
          </Badge>
          <span className="text-caption text-muted-foreground">עודכן {shortDate(item.updatedAt)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(item)}>עריכה</Button>
          <Button size="sm" variant="outline" onClick={() => onToggle(item)}>
            {published ? "הסתרה" : "פרסום"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(item.id)}>מחיקה</Button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {item.question && (
          <p className="text-body text-foreground font-medium break-words">{item.question}</p>
        )}
        <p className="text-caption text-muted-foreground whitespace-pre-wrap break-words line-clamp-4">
          {item.answerText}
        </p>
        {item.keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.keywords.map((k) => (
              <Badge key={k} variant="secondary" className="text-caption">{k}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FaqTab({ toast }) {
  const [answers, setAnswers] = useState([]);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [yearbookMap, setYearbookMap] = useState({});
  const [draft, setDraft]   = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (pageNum = 1) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/curated-answers?page=${pageNum}&limit=20`);
      const items = data.answers || [];
      setAnswers((prev) => (pageNum === 1 ? items : [...prev, ...items]));
      setPage(pageNum);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiFetch("/api/yearbooks")
      .then((data) => {
        const map = {};
        (data.yearbooks || []).forEach((y) => { map[y.id] = y.label; });
        setYearbookMap(map);
      })
      .catch(() => {});
  }, []);

  const openEdit = (item) => {
    setDraft({
      id: item.id,
      question: item.question || "",
      answerText: item.answerText || "",
      keywords: (item.keywords || []).join(", "),
      yearbook: item.yearbook || "",
      allYearbooks: !item.yearbook,
      status: item.status || "published",
    });
  };

  const save = async () => {
    if (!draft?.answerText.trim()) {
      toast("error", "חסרה תשובה");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/curated-answers/${encodeURIComponent(draft.id)}`, {
        method: "PUT",
        body: {
          question: draft.question,
          answerText: draft.answerText,
          keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          yearbook: draft.allYearbooks ? null : (draft.yearbook || null),
          status: draft.status,
        },
      });
      toast("ok", "התשובה עודכנה.");
      setDraft(null);
      load(1);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    try {
      await apiFetch(`/api/admin/curated-answers/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        body: { status: item.status === "published" ? "draft" : "published" },
      });
      toast("ok", item.status === "published" ? "התשובה הוסתרה." : "התשובה פורסמה.");
      load(1);
    } catch (e) {
      toast("error", e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("למחוק תשובה זו לצמיתות?")) return;
    try {
      await apiFetch(`/api/admin/curated-answers/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("ok", "התשובה נמחקה.");
      load(1);
    } catch (e) {
      toast("error", e.message);
    }
  };

  return (
    <>
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-heading">תשובות מוכנות</h2>
          <Button size="sm" variant="outline" onClick={() => load(1)} disabled={loading}>רענון</Button>
        </div>

        {loading && answers.length === 0 ? (
          <div className="py-10 text-center text-body text-muted-foreground animate-pulse">טוען תשובות...</div>
        ) : answers.length === 0 ? (
          <div className="py-10 text-center text-body text-muted-foreground">
            עדיין אין תשובות מוכנות. אפשר ליצור תשובה מתוך "שאלות ללא מענה".
          </div>
        ) : (
          <div className="space-y-3">
            {answers.map((a) => (
              <AnswerCard
                key={a.id}
                item={a}
                yearbookLabel={yearbookMap[a.yearbook]}
                onEdit={openEdit}
                onToggle={toggleStatus}
                onDelete={remove}
              />
            ))}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button size="sm" variant="outline" onClick={() => load(page + 1)} disabled={loading}>
                  {loading ? "טוען..." : "טען עוד"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>עריכת תשובה</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>שאלה (לצורך זיהוי)</Label>
              <Input
                value={draft.question}
                onChange={(e) => setDraft((p) => ({ ...p, question: e.target.value }))}
                placeholder="ניסוח מייצג של השאלה"
              />
            </div>

            <div className="space-y-1.5">
              <Label>תשובה (תוצג לסטודנטים)</Label>
              <Textarea
                rows={5}
                value={draft.answerText}
                onChange={(e) => setDraft((p) => ({ ...p, answerText: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>מילות מפתח (מופרדות בפסיק)</Label>
              <Input
                value={draft.keywords}
                onChange={(e) => setDraft((p) => ({ ...p, keywords: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-body cursor-pointer">
              <input
                type="checkbox"
                checked={draft.allYearbooks}
                onChange={(e) => setDraft((p) => ({ ...p, allYearbooks: e.target.checked }))}
              />
              <span>
                להחיל על כל השנתונים
                {!draft.allYearbooks && draft.yearbook
                  ? ` (אחרת: ${yearbookMap[draft.yearbook] || draft.yearbook})`
                  : ""}
              </span>
            </label>
          </div>
        )}
        <DialogFooter className="flex-row gap-2 justify-start">
          <Button onClick={save} disabled={saving}>{saving ? "שומר..." : "שמירה"}</Button>
          <Button variant="outline" onClick={() => setDraft(null)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
