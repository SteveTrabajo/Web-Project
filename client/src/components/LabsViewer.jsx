import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ChevronDownIcon } from "lucide-react";

const SEMESTERS = [2, 3, 4, 5, 6, 7];
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const DAY_ORDER = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const dayRank = (d = "") => {
  const i = DAY_ORDER.findIndex((x) => d.includes(x));
  return i === -1 ? 99 : i;
};

// Compact labelled dropdown used across the filter bar. Shows the selected
// option's label (not its raw value) and an "all" entry at the top.
function FilterSelect({ label, value, onValueChange, options, allLabel }) {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-caption text-content-muted h-4 leading-4">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger dir="rtl" className="w-full h-9 px-3 [&>span]:text-right">
          <span>{value === "ALL" ? allLabel : selected?.label ?? value}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

// Multi-day labs (date + dateEnd) render as "14-16/06/2026"
const formatDateRange = (row) => {
  if (!row?.dateEnd) return formatDate(row?.date);
  const [y1, m1, d1] = String(row.date).split("-");
  const [y2, m2, d2] = String(row.dateEnd).split("-");
  if (!y1 || !y2) return formatDate(row.date);
  if (y1 === y2 && m1 === m2) return `${d1}-${d2}/${m1}/${y1}`;
  return `${d1}/${m1}-${d2}/${m2}/${y2}`;
};

function buildFlat(data, fallbackSemester) {
  if (Array.isArray(data?.labsFlat)) return data.labsFlat;

  const processCourses = (coursesObj, semId) =>
    Object.entries(coursesObj || {}).flatMap(([code, c]) =>
      (c.labs || []).map((lab) => ({
        semester: Number(semId) || fallbackSemester,
        courseCode: c.courseCode || code,
        courseName: c.courseName || "",
        ...lab,
      }))
    );

  if (data?.semesters) {
    return Object.entries(data.semesters).flatMap(([id, obj]) =>
      processCourses(obj.courses, id)
    );
  }
  return processCourses(data?.courses, fallbackSemester);
}

export default function LabsViewer() {
  const [yearbooks, setYearbooks] = useState([]);
  const [yearbookId, setYearbookId] = useState("tashpav");
  const [semester, setSemester] = useState(2);
  const [labs, setLabs] = useState([]);
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [lecturerFilter, setLecturerFilter] = useState("ALL");
  // Staged bar selections; committed to the applied state above only on "apply".
  const [draft, setDraft] = useState({
    yearbookId: "tashpav", semester: 2,
    course: "ALL", date: "ALL", day: "ALL", time: "ALL", group: "ALL", lecturer: "ALL",
  });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadYears = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/labs-years`);
      const data = await res.json();
      const list = data?.years || [];
      setYearbooks(list);
      return list;
    } catch (e) {
      return [];
    }
  }, []);

  useEffect(() => {
    loadYears().then((list) => {
      if (list.length && !list.some((y) => y.id === yearbookId)) {
        setYearbookId(list[0].id);
        setDraft((d) => ({ ...d, yearbookId: list[0].id }));
      }
    });
  }, [loadYears]);

  useEffect(() => {
    const loadLabs = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/labs/${yearbookId}/${semester}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setLabs(buildFlat(data, semester));
        setCourseFilter("ALL");
        setDateFilter("ALL");
        setDayFilter("ALL");
        setTimeFilter("ALL");
        setGroupFilter("ALL");
        setLecturerFilter("ALL");
        setDraft((d) => ({
          ...d, course: "ALL", date: "ALL", day: "ALL", time: "ALL", group: "ALL", lecturer: "ALL",
        }));
      } catch (e) {
        setLabs([]);
        setError("לא נמצאו נתונים");
      } finally {
        setLoading(false);
      }
    };
    loadLabs();
  }, [yearbookId, semester, reloadKey]);

  useEffect(() => {
    const onUpdated = async (e) => {
      const { yearId, semester: sem } = e?.detail || {};
      await loadYears();
      if (yearId) setYearbookId(yearId);
      if (sem) setSemester(Number(sem));
      setDraft((d) => ({
        ...d,
        ...(yearId ? { yearbookId: yearId } : {}),
        ...(sem ? { semester: Number(sem) } : {}),
      }));
      setReloadKey((k) => k + 1);
    };
    window.addEventListener("labs-updated", onUpdated);
    return () => window.removeEventListener("labs-updated", onUpdated);
  }, [loadYears]);

  const coursesList = useMemo(() => {
    const m = new Map();
    labs.forEach((l) => m.set(l.courseCode, l.courseName));
    return Array.from(m.entries()).map(([code, name]) => ({ code, name }));
  }, [labs]);

  // Distinct values present in the loaded labs, used to build the filter dropdowns.
  const filterOptions = useMemo(() => {
    const days = new Set();
    const times = new Set();
    const groups = new Set();
    const lecturers = new Set();
    const dates = new Map(); // date -> display label (ranges show as "14-16/06/2026")
    labs.forEach((l) => {
      if (l.day) days.add(l.day);
      if (l.time) times.add(l.time);
      if (l.group) groups.add(l.group);
      if (l.date && !dates.has(l.date)) dates.set(l.date, formatDateRange(l));
      (l.staff || []).forEach((s) => s && lecturers.add(s));
    });
    return {
      courses: coursesList.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` })),
      dates: [...dates.keys()].sort().map((d) => ({ value: d, label: dates.get(d) })),
      days: [...days].sort((a, b) => dayRank(a) - dayRank(b)).map((d) => ({ value: d, label: d })),
      times: [...times].sort().map((t) => ({ value: t, label: t })),
      groups: [...groups].sort().map((g) => ({ value: g, label: g })),
      lecturers: [...lecturers].sort().map((s) => ({ value: s, label: s })),
    };
  }, [labs, coursesList]);

  const grouped = useMemo(() => {
    const filtered = labs.filter((l) => {
      if (courseFilter !== "ALL" && l.courseCode !== courseFilter) return false;
      if (dateFilter !== "ALL" && l.date !== dateFilter) return false;
      if (dayFilter !== "ALL" && l.day !== dayFilter) return false;
      if (timeFilter !== "ALL" && l.time !== timeFilter) return false;
      if (groupFilter !== "ALL" && l.group !== groupFilter) return false;
      if (lecturerFilter !== "ALL" && !(l.staff || []).includes(lecturerFilter)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateA - dateB;
    });
    const groups = {};
    sorted.forEach((l) => {
      if (!groups[l.courseCode]) {
        groups[l.courseCode] = { courseCode: l.courseCode, courseName: l.courseName, rows: [] };
      }
      groups[l.courseCode].rows.push(l);
    });
    return Object.values(groups);
  }, [labs, courseFilter, dateFilter, dayFilter, timeFilter, groupFilter, lecturerFilter]);

  const yearOptions = yearbooks.length ? yearbooks : [{ id: yearbookId, label: yearbookId }];

  const activeFilterCount = [courseFilter, dateFilter, dayFilter, timeFilter, groupFilter, lecturerFilter]
    .filter((v) => v !== "ALL").length;

  const setDraftField = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  // True when the staged draft differs from what is currently applied.
  const dirty =
    draft.yearbookId !== yearbookId ||
    draft.semester !== semester ||
    draft.course !== courseFilter ||
    draft.date !== dateFilter ||
    draft.day !== dayFilter ||
    draft.time !== timeFilter ||
    draft.group !== groupFilter ||
    draft.lecturer !== lecturerFilter;

  // Commit the draft. Only runs when something changed; a server request is
  // triggered only if the yearbook/semester changed (the load effect depends
  // on those), while pure column filters just re-filter the loaded data.
  const applyFilters = () => {
    if (!dirty) return;
    setYearbookId(draft.yearbookId);
    setSemester(draft.semester);
    setCourseFilter(draft.course);
    setDateFilter(draft.date);
    setDayFilter(draft.day);
    setTimeFilter(draft.time);
    setGroupFilter(draft.group);
    setLecturerFilter(draft.lecturer);
  };

  return (
    <div className="max-w-250 mx-auto p-2 sm:p-4 text-right text-content-primary" dir="rtl">
      <header className="mb-6">
        <h2 className="text-page-title mb-1 text-content-primary">לוח מעבדות</h2>
        <p className="text-body text-content-muted">ריכוז כל מועדי המעבדות לפי קורס, תאריך וקבוצה</p>
      </header>

      {/* Filters */}
      <Card className="mb-6 py-2">
        <CardContent className={filtersOpen ? "px-4 pb-4" : "px-4"}>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 rounded-lg -mx-2 px-2 py-1 hover:bg-surface-raised transition-colors"
            aria-expanded={filtersOpen}
          >
            <span className="text-heading text-content-primary flex items-center gap-2">
              🔎 סינון
              {activeFilterCount > 0 && (
                <span className="text-caption bg-bio-green/10 text-bio-green dark:bg-bio-green-glow/10 dark:text-bio-green-glow px-2 py-0.5 rounded-full font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5 text-caption font-medium text-content-muted">
              {filtersOpen ? "הסתר" : "הצג"}
              <span className="flex items-center justify-center size-6 rounded-full bg-surface-raised">
                <ChevronDownIcon
                  className={`size-4 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
                />
              </span>
            </span>
          </button>

          {filtersOpen && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end">

              <div className="flex flex-col gap-1">
                <Label className="text-caption text-content-muted h-4 leading-4">שנתון</Label>
                <Select value={draft.yearbookId} onValueChange={setDraftField("yearbookId")}>
                  <SelectTrigger dir="rtl" className="w-full h-9 px-3 [&>span]:text-right">
                    <span>{yearOptions.find((y) => y.id === draft.yearbookId)?.label || draft.yearbookId}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-caption text-content-muted h-4 leading-4">סמסטר</Label>
                <Select value={String(draft.semester)} onValueChange={(v) => setDraftField("semester")(Number(v))}>
                  <SelectTrigger dir="rtl" className="w-full h-9 px-3 [&>span]:text-right">
                    <span>סמסטר {draft.semester}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map((s) => (
                      <SelectItem key={s} value={String(s)}>סמסטר {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FilterSelect
                label="קורס"
                value={draft.course}
                onValueChange={setDraftField("course")}
                options={filterOptions.courses}
                allLabel="כל הקורסים"
              />
              <FilterSelect
                label="תאריך"
                value={draft.date}
                onValueChange={setDraftField("date")}
                options={filterOptions.dates}
                allLabel="כל התאריכים"
              />
              <FilterSelect
                label="יום"
                value={draft.day}
                onValueChange={setDraftField("day")}
                options={filterOptions.days}
                allLabel="כל הימים"
              />
              <FilterSelect
                label="שעה"
                value={draft.time}
                onValueChange={setDraftField("time")}
                options={filterOptions.times}
                allLabel="כל השעות"
              />
              <FilterSelect
                label="קבוצה"
                value={draft.group}
                onValueChange={setDraftField("group")}
                options={filterOptions.groups}
                allLabel="כל הקבוצות"
              />
              <FilterSelect
                label="מרצה / צוות"
                value={draft.lecturer}
                onValueChange={setDraftField("lecturer")}
                options={filterOptions.lecturers}
                allLabel="כל המרצים"
              />

            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={applyFilters} disabled={!dirty}>
                החל סינון
              </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {loading && <div className="text-body text-bio-green animate-pulse">טוען נתונים...</div>}
      {error && <div className="text-body text-red-600 font-bold">{error}</div>}
      {!loading && !error && grouped.length === 0 && (
        <div className="text-body text-red-600 mt-4">לא נמצאו נתונים</div>
      )}

      {/* Course cards */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div
            key={group.courseCode}
            className="border border-surface-border rounded-xl overflow-hidden bg-surface-card shadow-sm"
          >
            <div className="p-4 bg-surface-raised border-b border-surface-border flex flex-wrap justify-between items-center gap-2">
              <div className="text-heading text-content-primary">
                {group.courseCode}{" "}
                <span className="font-medium text-content-muted">- {group.courseName}</span>
              </div>
              <div className="text-caption bg-bio-green/10 text-bio-green dark:bg-bio-green-glow/10 dark:text-bio-green-glow px-3 py-1 rounded-full font-semibold">
                {group.rows.length} מפגשים
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-body text-right border-collapse">
                <thead>
                  <tr className="bg-surface-raised border-b border-surface-border text-content-muted">
                    {["מפגש", "תאריך", "יום", "שעה", "קבוצה", "צוות"].map((h) => (
                      <th key={h} className="p-2 sm:p-3 border-l border-surface-border last:border-l-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-surface-border last:border-0 ${
                        idx % 2 === 0 ? "bg-surface-card" : "bg-surface-page"
                      }`}
                    >
                      <td className="p-2 sm:p-3 text-center text-content-primary">{row.session}</td>
                      <td className="p-2 sm:p-3 text-center font-bold tracking-tight text-content-primary">{formatDateRange(row)}</td>
                      <td className="p-2 sm:p-3 text-center text-content-primary">{row.day}</td>
                      <td className="p-2 sm:p-3 text-center text-bio-teal dark:text-bio-teal-glow font-semibold">{row.time}</td>
                      <td className="p-2 sm:p-3 text-center text-content-primary">{row.group}</td>
                      <td className="p-2 sm:p-3 text-content-muted">{row.staff?.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
