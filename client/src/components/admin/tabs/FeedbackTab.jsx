import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "../utils/adminApi";

const REASON_LABELS = {
  insufficient:  "מידע לא מספיק",
  unclear:       "מידע לא ברור",
  irrelevant:    "תשובה לא רלוונטית",
  outdated:      "מידע לא עדכני",
  missing_topic: "נושא לא מכוסה",
  other:         "אחר",
};

function FeedbackCard({ item }) {
  const isPositive = item.rating === "positive";
  const relativeTime = (() => {
    if (!item.createdAt) return "";
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "הרגע";
    if (minutes < 60) return `לפני ${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  })();

  return (
    <div className="flex gap-3 p-3 rounded-xl border border-border bg-muted/30">
      <div className="text-2xl shrink-0">{isPositive ? "👍" : "👎"}</div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {item.reasons?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.reasons.map((r) => (
              <Badge key={r} variant="secondary" className="text-[11px]">
                {REASON_LABELS[r] ?? r}
              </Badge>
            ))}
          </div>
        )}
        {item.comment && (
          <p className="text-xs text-foreground break-words">{item.comment}</p>
        )}
        <div className="text-[11px] text-muted-foreground">{relativeTime}</div>
      </div>
    </div>
  );
}

export default function FeedbackTab({ toast }) {
  const [feedback, setFeedback]               = useState([]);
  const [feedbackPage, setFeedbackPage]       = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackHasMore, setFeedbackHasMore] = useState(true);

  const loadFeedback = async (page = 1) => {
    setFeedbackLoading(true);
    try {
      const data = await apiFetch(`/api/admin/feedback?page=${page}&limit=20`);
      const items = data.feedback || [];
      setFeedback((prev) => (page === 1 ? items : [...prev, ...items]));
      setFeedbackPage(page);
      setFeedbackHasMore(items.length === 20);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  useEffect(() => { loadFeedback(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-heading">משובים</h2>
          <Button size="sm" variant="outline" onClick={() => loadFeedback(1)} disabled={feedbackLoading}>
            רענון
          </Button>
        </div>

        {feedbackLoading && feedback.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">טוען משובים...</div>
        ) : feedback.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">אין משובים עדיין</div>
        ) : (
          <div className="space-y-3">
            {feedback.map((f) => <FeedbackCard key={f.id} item={f} />)}
            {feedbackHasMore && (
              <div className="pt-2 flex justify-center">
                <Button size="sm" variant="outline" onClick={() => loadFeedback(feedbackPage + 1)} disabled={feedbackLoading}>
                  {feedbackLoading ? "טוען..." : "טען עוד"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
