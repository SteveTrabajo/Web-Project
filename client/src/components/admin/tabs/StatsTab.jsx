import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "../utils/adminApi";

// Client-side topic keys sent from Bot.jsx context.topic
const TOPIC_LABELS = {
  courses:      "קורסי חובה",
  advisor:      "יועץ אקדמי",
  exceptional:  "רישום חריג",
  registration: "רישום",
  labs:         "לוח מעבדות",
  military:     "מילואים",
  emotional:    "ייעוץ רגשי",
  אחר:          "אחר",
};

// Server-determined answer source
const SOURCE_LABELS = {
  curated:      "תשובה מוכנה",
  courses:      "קורסים ודרישות",
  labs:         "לוח מעבדות",
  advisor:      "יועץ אקדמי",
  registration: "רישום",
  military:     "מילואים",
  emotional:    "ייעוץ רגשי",
  fallback:     "ללא מענה",
  unknown:      "לא ידוע",
};

const REASON_LABELS = {
  insufficient: "תשובה חלקית",
  unclear: "לא ברורה",
  irrelevant: "לא רלוונטית",
  outdated: "לא עדכנית",
  missing_topic: "חסר נושא",
  fallback_no_answer: "ללא מענה (אוטו׳)",
  other: "אחר",
};

function shortDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function BarRow({ label, count, max }) {
  const pct = max ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-caption">
        <span className="truncate ml-2">{label}</span>
        <span className="text-muted-foreground shrink-0">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-right space-y-1">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-caption text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function StatsTab({ toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState("");

  const load = async (selectedDays = days) => {
    setLoading(true);
    try {
      const params = selectedDays ? `?days=${selectedDays}` : "";
      const result = await apiFetch(`/api/admin/usage-stats${params}`);
      setData(result);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="py-10 text-center text-body text-muted-foreground animate-pulse">
            טוען סטטיסטיקות...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="py-10 text-center text-body text-muted-foreground">
            לא נטענו נתונים
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxSource = Math.max(...(data.byAnswerSource || []).map((s) => s.count), 1);
  const maxTopic  = Math.max(...(data.byTopic || []).map((t) => t.count), 1);
  const maxSem    = Math.max(...(data.bySemester || []).map((s) => s.count), 1);
  const maxCourse = Math.max(...(data.topCourses || []).map((c) => c.count), 1);
  const maxReason = Math.max(
    ...(data.feedbackSummary?.negativeReasons || []).map((r) => r.count),
    1
  );

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header + filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-heading">סטטיסטיקות שימוש</h2>
            <div className="flex items-center gap-2">
              <select
                className="text-caption rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  load(e.target.value);
                }}
              >
                <option value="">כל הזמן</option>
                <option value="7">7 ימים</option>
                <option value="30">30 ימים</option>
                <option value="90">90 ימים</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
                {loading ? "טוען..." : "רענון"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="סה״כ שאלות" value={data.totalQuestions} />
        <KpiCard label="שאלות שנענו" value={data.answeredQuestions} />
        <KpiCard label="שאלות ללא מענה" value={data.unansweredQuestions} />
        <KpiCard label="אחוז מענה" value={`${data.answerRate}%`} />
        <KpiCard
          label="סה״כ משובים"
          value={data.feedbackSummary?.totalFeedback ?? 0}
          sub={`שליליים: ${data.feedbackSummary?.negative ?? 0}`}
        />
      </div>

      {/* By answer source */}
      {data.byAnswerSource?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-body font-semibold">פילוח לפי מקור תשובה</h3>
            {data.byAnswerSource.map(({ source, count }) => (
              <BarRow
                key={source}
                label={SOURCE_LABELS[source] || source}
                count={count}
                max={maxSource}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* By topic */}
      {data.byTopic?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-body font-semibold">פילוח לפי נושא</h3>
            {data.byTopic.map(({ topic, count }) => (
              <BarRow
                key={topic}
                label={TOPIC_LABELS[topic] || topic}
                count={count}
                max={maxTopic}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* By semester */}
      {data.bySemester?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-body font-semibold">פילוח לפי סמסטר</h3>
            {data.bySemester.map(({ semester, count }) => (
              <BarRow key={semester} label={semester} count={count} max={maxSem} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top courses */}
      {data.topCourses?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-body font-semibold">קורסים שעלו הרבה בשאלות</h3>
            {data.topCourses.map(({ course, count }) => (
              <BarRow key={course} label={course} count={count} max={maxCourse} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Negative feedback reasons */}
      {data.feedbackSummary?.negativeReasons?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-body font-semibold">סיבות משוב שלילי</h3>
            {data.feedbackSummary.negativeReasons.map(({ reason, count }) => (
              <BarRow
                key={reason}
                label={REASON_LABELS[reason] || reason}
                count={count}
                max={maxReason}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent unanswered questions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-body font-semibold">שאלות אחרונות ללא מענה</h3>
          {data.recentUnanswered?.length === 0 ? (
            <p className="text-body text-muted-foreground py-2 text-center">
              אין שאלות ללא מענה להצגה.
            </p>
          ) : (
            <div className="space-y-2">
              {(data.recentUnanswered || []).map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1"
                >
                  <p className="text-body text-foreground break-words">{q.question}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {q.yearbook && (
                      <Badge variant="outline" className="text-caption">
                        {q.yearbook}
                      </Badge>
                    )}
                    {q.semester && (
                      <Badge variant="outline" className="text-caption">
                        סמסטר {q.semester}
                      </Badge>
                    )}
                    {q.topic && (
                      <Badge variant="secondary" className="text-caption">
                        {TOPIC_LABELS[q.topic] || q.topic}
                      </Badge>
                    )}
                    {q.createdAt && (
                      <span className="text-caption text-muted-foreground">
                        {shortDate(q.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
