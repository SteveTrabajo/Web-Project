import { useEffect, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "../utils/adminApi";

/* ── project colors ───────────────────────────────────────── */
const C_NAVY  = "#162A5A";  // bar fill
const C_LABEL = "#36513B";  // axis text
const C_GRID  = "#BFCFC1";  // grid lines

/* ── display labels (used on x-axis AND in tooltip) ─────── */

const SOURCE_LABELS = {
  curated:      "תשובה מוכנה",
  courses:      "קורסים",
  labs:         "מעבדות",
  advisor:      "יועץ אקדמי",
  registration: "רישום",
  military:     "מילואים",
  emotional:    "ייעוץ רגשי",
  fallback:     "ללא מענה",
  unknown:      "לא ידוע",
};

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

const REASON_LABELS = {
  insufficient:       "תשובה חלקית",
  unclear:            "לא ברורה",
  irrelevant:         "לא רלוונטית",
  outdated:           "לא עדכנית",
  missing_topic:      "חסר נושא",
  fallback_no_answer: "ללא מענה",
  other:              "אחר",
};

function shortDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/* ── shared axis tick style ───────────────────────────────── */
const TICK_STYLE = {
  fontSize: 11,
  fill: C_LABEL,
  fontFamily: "Heebo, ui-sans-serif, sans-serif",
};

/* ── vertical bar chart section ───────────────────────────── */

/**
 * items: Array<{ label: string, count: number }>
 *   label  – display label used on x-axis tick AND in tooltip
 *   count  – the integer value
 *
 * note  – explanatory line rendered below the chart
 */
function ChartSection({ title, subtitle, items, unit = "שאלות", note }) {
  const labels = items.map((i) => i.label);
  const counts = items.map((i) => i.count);
  const total  = counts.reduce((s, c) => s + c, 0);

  /* y-axis title text */
  const yLabel = unit === "שאלות" ? "מספר שאלות" : "מספר משובים";

  return (
    <Card>
      <CardContent className="p-4 space-y-1">

        {/* Section heading — stays in RTL */}
        <div dir="rtl">
          <h3 className="text-body font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-caption text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-caption text-muted-foreground text-center py-4" dir="rtl">
            אין עדיין נתונים להצגה
          </p>
        ) : (
          <>
            {/* dir="ltr" stops the RTL parent from mirroring the SVG axes */}
            <div dir="ltr">
              <BarChart
                /* ── axes ──────────────────────────────────────────── */
                xAxis={[{
                  scaleType: "band",
                  data: labels,
                  /* tickLabelStyle handles font/color;
                     rotation is applied via sx below */
                  tickLabelStyle: { ...TICK_STYLE, fontSize: 10 },
                }]}
                yAxis={[{
                  tickMinStep: 1,
                  tickLabelStyle: { ...TICK_STYLE, fontSize: 10 },
                  /* y-axis title makes "number of questions" explicit */
                  label: yLabel,
                }]}

                /* ── data series ────────────────────────────────────── */
                series={[{
                  data: counts,
                  color: C_NAVY,

                  /* count number shown above each bar */
                  barLabel: (item) =>
                    item.value != null ? String(item.value) : null,
                  barLabelPlacement: "outside",

                  /* tooltip: "תשובה מוכנה: 3 שאלות (21%)" */
                  valueFormatter: (v, { dataIndex }) => {
                    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                    return `${labels[dataIndex]}: ${v} ${unit} (${pct}%)`;
                  },
                }]}

                /* ── layout ────────────────────────────────────────── */
                height={290}
                margin={{
                  top:    32,   /* room for bar-top count labels */
                  right:  16,
                  /*
                   * bottom: Hebrew labels are rotated -35°.
                   * At that angle a 10-char label needs ~50px vertical
                   * clearance; 72px gives comfortable breathing room.
                   */
                  bottom: 72,
                  /*
                   * left: y-axis tick numbers + rotated y-axis title.
                   * Small integers (≤2 chars) need ~20px; title ~24px.
                   */
                  left:   52,
                }}

                grid={{ horizontal: true }}
                slotProps={{ legend: { hidden: true } }}

                sx={{
                  /* ── grid lines ─────────────────────────────────── */
                  "& .MuiChartsGrid-line": {
                    stroke: C_GRID,
                    strokeWidth: 1,
                    strokeDasharray: "4 3",
                  },

                  /* ── axis structural lines & ticks ──────────────── */
                  "& .MuiChartsAxis-line": { stroke: C_GRID },
                  "& .MuiChartsAxis-tick": { stroke: C_GRID },

                  /*
                   * Rotate x-axis tick labels -35° around their own center
                   * so even the longest Hebrew labels don't overlap.
                   * transform-box: fill-box makes the origin relative to
                   * the element's bounding box (not the SVG viewport).
                   */
                  "& .MuiChartsAxis-directionX .MuiChartsAxis-tickLabel": {
                    transformBox:    "fill-box",
                    transformOrigin: "center center",
                    transform:       "rotate(-35deg)",
                  },

                  /* ── y-axis title ───────────────────────────────── */
                  "& .MuiChartsAxis-directionY .MuiChartsAxis-label": {
                    fill:       C_LABEL,
                    fontSize:   10,
                    fontFamily: "Heebo, ui-sans-serif, sans-serif",
                  },

                  /* ── bar-top count labels ───────────────────────── */
                  "& .MuiBar-label": {
                    fill:       C_NAVY,
                    fontSize:   11,
                    fontWeight: 600,
                    fontFamily: "Heebo, ui-sans-serif, sans-serif",
                  },
                }}
              />
            </div>

            {/* Explanatory note below the chart */}
            <p className="text-caption text-muted-foreground pt-0.5" dir="rtl">
              {note ?? `המספר מעל כל עמודה מייצג כמות ${unit}`}
            </p>
          </>
        )}

        {items.length === 1 && (
          <p
            className="text-caption text-muted-foreground border-t border-border pt-2"
            dir="rtl"
          >
            כל הנתונים בתקופה שנבחרה שייכים לקטגוריה זו
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── KPI card (unchanged) ─────────────────────────────────── */

function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-right space-y-1">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-caption text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── main tab ─────────────────────────────────────────────── */

export default function StatsTab({ toast }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays]       = useState("");

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

  /* ── loading / empty states ───────────────────────────────── */

  if (loading && !data) {
    return (
      <Card><CardContent className="p-4">
        <div className="py-10 text-center text-body text-muted-foreground animate-pulse">
          טוען סטטיסטיקות...
        </div>
      </CardContent></Card>
    );
  }

  if (!data) {
    return (
      <Card><CardContent className="p-4">
        <div className="py-10 text-center text-body text-muted-foreground">
          לא נטענו נתונים
        </div>
      </CardContent></Card>
    );
  }

  /* ── render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-4" dir="rtl">

      {/* header + time filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-heading">סטטיסטיקות שימוש</h2>
            <div className="flex items-center gap-2">
              <select
                className="text-caption rounded-lg border border-border bg-background px-2 py-1.5 text-foreground"
                value={days}
                onChange={(e) => { setDays(e.target.value); load(e.target.value); }}
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

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="סה״כ שאלות"     value={data.totalQuestions} />
        <KpiCard label="שאלות שנענו"    value={data.answeredQuestions} />
        <KpiCard label="שאלות ללא מענה" value={data.unansweredQuestions} />
        <KpiCard label="אחוז מענה"      value={`${data.answerRate}%`} />
        <KpiCard
          label="סה״כ משובים"
          value={data.feedbackSummary?.totalFeedback ?? 0}
          sub={`שליליים: ${data.feedbackSummary?.negative ?? 0}`}
        />
      </div>

      {/* ── chart 1: answer source ───────────────────────────── */}
      <ChartSection
        title="פילוח לפי מקור תשובה"
        subtitle="כמה שאלות התקבלו מכל מקור תשובה"
        items={(data.byAnswerSource || []).map(({ source, count }) => ({
          count,
          label: SOURCE_LABELS[source] || source || "אחר",
        }))}
        unit="שאלות"
        note="העמודות מציגות כמה שאלות נענו מכל סוג מקור"
      />

      {/* ── chart 2: topic ───────────────────────────────────── */}
      <ChartSection
        title="פילוח לפי נושא"
        subtitle="כמה שאלות נשאלו בכל נושא שנבחר בצ׳אט"
        items={(data.byTopic || []).map(({ topic, count }) => ({
          count,
          label: TOPIC_LABELS[topic] || topic || "אחר",
        }))}
        unit="שאלות"
        note="העמודות מציגות כמה שאלות נשאלו בכל נושא"
      />

      {/* ── chart 3: semester ────────────────────────────────── */}
      <ChartSection
        title="פילוח לפי סמסטר"
        subtitle="כמה שאלות נשאלו מכל סמסטר"
        items={(data.bySemester || []).map(({ semester, count }) => ({
          count,
          /* "סמסטר 6" makes the axis label self-explanatory */
          label: semester ? `סמסטר ${semester}` : "לא ידוע",
        }))}
        unit="שאלות"
        note="העמודות מציגות את מספר השאלות לפי הסמסטר שנבחר בצ׳אט"
      />

      {/* ── chart 4: top courses (conditional) ──────────────── */}
      {(data.topCourses?.length ?? 0) > 0 && (
        <ChartSection
          title="קורסים שעלו הרבה בשאלות"
          subtitle="קורסי חובה שהוזכרו בשאלות"
          items={(data.topCourses || []).map(({ course, count }) => ({
            count,
            label: course || "לא ידוע",
          }))}
          unit="שאלות"
          note="המספר מעל כל עמודה מייצג כמות שאלות שהוזכר הקורס"
        />
      )}

      {/* ── chart 5: negative feedback reasons ──────────────── */}
      <ChartSection
        title="סיבות משוב שלילי"
        subtitle="כמה פעמים נבחרה כל סיבה במשובים שליליים"
        items={(data.feedbackSummary?.negativeReasons || []).map(({ reason, count }) => ({
          count,
          label: REASON_LABELS[reason] || reason || "אחר",
        }))}
        unit="משובים"
        note="העמודות מציגות כמה פעמים כל סיבה נבחרה במשוב שלילי"
      />

      {/* ── recent unanswered questions list ─────────────────── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-0.5">
            <h3 className="text-body font-semibold">שאלות אחרונות ללא מענה</h3>
            <p className="text-caption text-muted-foreground">
              20 השאלות האחרונות שהבוט לא הצליח לענות עליהן
            </p>
          </div>

          {(data.recentUnanswered?.length ?? 0) === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-2">
              אין עדיין נתונים להצגה
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentUnanswered.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1"
                >
                  <p className="text-body text-foreground break-words">{q.question}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {q.yearbook && (
                      <Badge variant="outline" className="text-caption">{q.yearbook}</Badge>
                    )}
                    {q.semester && (
                      <Badge variant="outline" className="text-caption">סמסטר {q.semester}</Badge>
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
