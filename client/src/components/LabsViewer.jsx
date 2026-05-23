import { useEffect, useMemo, useState, useCallback } from "react";

const SEMESTERS = [2, 3, 4, 5, 6, 7];
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
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

  const grouped = useMemo(() => {
    const filtered = courseFilter === "ALL" ? labs : labs.filter((l) => l.courseCode === courseFilter);
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
  }, [labs, courseFilter]);

  const selectClass =
    "p-2 border border-surface-border rounded-md bg-surface-card text-content-primary outline-none focus:ring-2 focus:ring-brand-navy transition-colors";

  return (
    <div className="max-w-250 mx-auto p-4 text-right text-content-primary" dir="rtl">
      <header className="mb-6">
        <h2 className="text-3xl font-extrabold mb-1 text-content-primary">לוח מעבדות</h2>
        <p className="text-content-muted">ריכוז כל מועדי המעבדות לפי קורס, תאריך וקבוצה</p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center mb-6 p-3 bg-surface-raised border border-surface-border rounded-xl">
        <select value={yearbookId} onChange={(e) => setYearbookId(e.target.value)} className={selectClass}>
          {(yearbooks.length ? yearbooks : [{ id: yearbookId, label: yearbookId }]).map((y) => (
            <option key={y.id} value={y.id}>{y.label}</option>
          ))}
        </select>

        <select value={semester} onChange={(e) => setSemester(Number(e.target.value))} className={selectClass}>
          {SEMESTERS.map((s) => <option key={s} value={s}>סמסטר {s}</option>)}
        </select>

        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className={selectClass}>
          <option value="ALL">כל הקורסים</option>
          {coursesList.map((c) => (
            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-bio-green animate-pulse">טוען נתונים...</div>}
      {error && <div className="text-red-600 font-bold">{error}</div>}
      {!loading && !error && grouped.length === 0 && (
        <div className="text-red-600 mt-4">לא נמצאו נתונים</div>
      )}

      {/* Course cards */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div
            key={group.courseCode}
            className="border border-surface-border rounded-xl overflow-hidden bg-surface-card shadow-sm"
          >
            <div className="p-4 bg-surface-raised border-b border-surface-border flex justify-between items-center">
              <div className="text-lg font-bold text-content-primary">
                {group.courseCode}{" "}
                <span className="font-medium text-content-muted">- {group.courseName}</span>
              </div>
              <div className="text-xs bg-bio-green/10 text-bio-green dark:bg-bio-green-glow/10 dark:text-bio-green-glow px-3 py-1 rounded-full font-semibold">
                {group.rows.length} מפגשים
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-212.5 text-sm text-right border-collapse">
                <thead>
                  <tr className="bg-surface-raised border-b border-surface-border text-content-muted">
                    {["מפגש", "תאריך", "יום", "שעה", "קבוצה", "צוות"].map((h) => (
                      <th key={h} className="p-3 border-l border-surface-border last:border-l-0">{h}</th>
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
                      <td className="p-3 text-center text-content-primary">{row.session}</td>
                      <td className="p-3 text-center font-bold tracking-tight text-content-primary">{formatDate(row.date)}</td>
                      <td className="p-3 text-center text-content-primary">{row.day}</td>
                      <td className="p-3 text-center text-bio-teal dark:text-bio-teal-glow font-semibold">{row.time}</td>
                      <td className="p-3 text-center text-content-primary">{row.group}</td>
                      <td className="p-3 text-content-muted">{row.staff?.join(", ")}</td>
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
