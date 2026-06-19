import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "../utils/adminApi";

const REASON_LABELS = {
  insufficient:  "מידע לא מספיק",
  unclear:       "מידע לא ברור",
  irrelevant:    "תשובה לא רלוונטית",
  outdated:      "מידע לא עדכני",
  missing_topic: "נושא לא מכוסה",
  other:         "אחר",
};

function relativeTime(createdAt) {
  if (!createdAt) return "";
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

function fullDate(createdAt) {
  if (!createdAt) return "";
  return new Date(createdAt).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function QuestionCard({ item, onDelete, yearbookLabel }) {
  const questions = item.questions || [];
  const lastIndex = questions.length - 1;
  const hasFooter = (item.reasons?.length > 0) || item.comment;

  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 border-b border-border bg-muted/50">
        <Badge variant="outline" className="text-caption">
          {item.yearbook ? `שנתון ${yearbookLabel || item.yearbook}` : "שנתון לא ידוע"}
        </Badge>
        <div className="flex items-center gap-3">
          <div className="text-caption text-muted-foreground text-left leading-tight">
            <div>{relativeTime(item.createdAt)}</div>
            <div className="opacity-70">{fullDate(item.createdAt)}</div>
          </div>
          <Button size="sm" variant="destructive" onClick={() => onDelete(item.id)}>
            מחיקה
          </Button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <p className="text-caption font-semibold text-muted-foreground">השאלות האחרונות של המשתמש</p>
        <ol className="space-y-1.5">
          {questions.map((q, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption font-bold ${
                  i === lastIndex
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`break-words ${
                  i === lastIndex
                    ? "text-body text-foreground font-medium"
                    : "text-caption text-muted-foreground"
                }`}
              >
                {q}
              </span>
            </li>
          ))}
        </ol>

        {hasFooter && (
          <div className="space-y-2 pt-2 border-t border-border">
            {item.reasons?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.reasons.map((r) => (
                  <Badge key={r} variant="secondary" className="text-caption">
                    {REASON_LABELS[r] ?? r}
                  </Badge>
                ))}
              </div>
            )}
            {item.comment && (
              <p className="text-caption text-foreground break-words">
                <span className="text-muted-foreground">הערה: </span>{item.comment}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnansweredTab({ toast }) {
  const [questions, setQuestions] = useState([]);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");
  const [yearbookMap, setYearbookMap] = useState({});

  const loadQuestions = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 20 });
      if (fromDate) params.set("from", `${fromDate}T00:00:00.000Z`);
      if (toDate)   params.set("to",   `${toDate}T23:59:59.999Z`);
      const data = await apiFetch(`/api/admin/unanswered-questions?${params}`);
      const items = data.questions || [];
      setQuestions((prev) => (pageNum === 1 ? items : [...prev, ...items]));
      setPage(pageNum);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async (id) => {
    if (!confirm("למחוק שאלה זו?")) return;
    try {
      await apiFetch(`/api/admin/unanswered-questions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast("ok", "השאלה נמחקה.");
      loadQuestions(1);
    } catch (e) {
      toast("error", e.message);
    }
  };

  // Reload from page 1 whenever a filter changes, and on initial mount.
  useEffect(() => { loadQuestions(1); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map yearbook id -> Hebrew display name so cards show the name, not the id.
  useEffect(() => {
    apiFetch("/api/yearbooks")
      .then((data) => {
        const map = {};
        (data.yearbooks || []).forEach((y) => { map[y.id] = y.label; });
        setYearbookMap(map);
      })
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-heading">שאלות ללא מענה</h2>
          <Button size="sm" variant="outline" onClick={() => loadQuestions(1)} disabled={loading}>
            רענון
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">מתאריך</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">עד תאריך</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
        </div>

        {loading && questions.length === 0 ? (
          <div className="py-10 text-center text-body text-muted-foreground animate-pulse">טוען שאלות...</div>
        ) : questions.length === 0 ? (
          <div className="py-10 text-center text-body text-muted-foreground">אין שאלות ללא מענה עדיין</div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionCard key={q.id} item={q} onDelete={deleteQuestion} yearbookLabel={yearbookMap[q.yearbook]} />
            ))}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button size="sm" variant="outline" onClick={() => loadQuestions(page + 1)} disabled={loading}>
                  {loading ? "טוען..." : "טען עוד"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
