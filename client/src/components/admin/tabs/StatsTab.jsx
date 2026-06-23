import { useEffect, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "../utils/adminApi";
import { useTheme } from "@/theme/ThemeProvider";

/* ── theme-aware chart palette ────────────────────────────────
*/
const CHART_PALETTE = {
  light: { bar: "#162A5A", text: "#36513B", grid: "#BFCFC1", xLabel: "#162A5A", barLabel: "#162A5A" },
  dark:  { bar: "#34D399", text: "#AFCBDF", grid: "#1C3050", xLabel: "#FFFFFF", barLabel: "#FFFFFF" },
};

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

/* ── shared axis tick font (color is applied per-theme) ───── */
const TICK_FONT = {
  fontSize: 12,
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
  const { theme } = useTheme();
  const palette = CHART_PALETTE[theme] || CHART_PALETTE.light;

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
                  /* horizontal, high-contrast category labels under each bar */
                  tickLabelStyle: {
                    ...TICK_FONT,
                    fill: palette.xLabel,
                  },
                  /* force every label to show; the default 'auto' overlap
                     check otherwise drops some of them */
                  tickLabelInterval: () => true,
                  /*
                   * height must be tall enough for the labels. MUI derives the
                   * tick-label clearance from this axis height (default 25px),
                   * NOT from margin.bottom - too little space ellipsizes every
                   * horizontal label down to an empty string.
                   */
                  height: 52,
                }]}
                yAxis={[{
                  tickMinStep: 1,
                  tickLabelStyle: { ...TICK_FONT, fill: palette.text },
                  /* y-axis title makes "number of questions" explicit */
                  label: yLabel,
                }]}

                /* ── data series ────────────────────────────────────── */
                series={[{
                  data: counts,
                  color: palette.bar,

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
                   * bottom: horizontal labels wrap to up to ~2 lines at 12px.
                   * 56px fits two wrapped lines with breathing room.
                   */
                  bottom: 56,
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
                    stroke: palette.grid,
                    strokeWidth: 1,
                    strokeDasharray: "4 3",
                  },

                  /* ── axis structural lines & ticks ──────────────── */
                  "& .MuiChartsAxis-line": { stroke: palette.grid },
                  "& .MuiChartsAxis-tick": { stroke: palette.grid },

                  /* ── y-axis title ───────────────────────────────── */
                  "& .MuiChartsAxis-directionY .MuiChartsAxis-label": {
                    fill:       palette.text,
                    fontSize:   12,
                    fontFamily: "Heebo, ui-sans-serif, sans-serif",
                  },

                  /* ── bar-top count labels ───────────────────────── */
                  "& .MuiBarChart-label": {
                    fill:       palette.barLabel,
                    fontSize:   13,
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
    </div>
  );
}
