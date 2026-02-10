import { useEffect, useMemo, useState, useCallback } from "react";

/**
 * LabsViewer.jsx
 * --------------
 * Student-facing labs schedule viewer.
 *
 * Features:
 * - Loads available lab "years/yearbooks" from backend.
 * - Loads labs for selected yearbook + semester.
 * - Normalizes labs data into a flat list (buildFlat).
 * - Supports filtering by course and groups/sorts labs by date.
 * - Listens to a global "labs-updated" window event to refresh data.
 *
 * Backend endpoints:
 * - GET  `${API_BASE}/api/labs-years`  -> { years: [{ id, label, ... }] }
 * - GET  `${API_BASE}/api/labs/:yearbookId/:semester` -> labs data (nested or flat)
 */

const SEMESTERS = [2, 3, 4, 5, 6, 7];
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";


/**
 * formatDate(iso)
 * - Converts "YYYY-MM-DD" into "DD/MM/YYYY" for display.
 */
const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

/*
 * - Ensures each lab row includes: semester, courseCode, courseName, ...lab fields.
 */
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
  // Loaded yearbooks/years list from backend
  const [yearbooks, setYearbooks] = useState([]);

  // Selected yearbook + semester
  const [yearbookId, setYearbookId] = useState("tashpav");
  const [semester, setSemester] = useState(2);

  // Labs rows (flat)
  const [labs, setLabs] = useState([]);

  // Course filter ("ALL" or a courseCode)
  const [courseFilter, setCourseFilter] = useState("ALL");

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Used to force refresh when an external "labs-updated" event occurs
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * loadYears()
   * - Fetches available lab years/yearbooks from backend.
   * - Also returns the list so caller can decide default selection.
   */
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

  // On mount: load yearbooks, and ensure selected yearbookId is valid
  useEffect(() => {
    loadYears().then((list) => {
      if (list.length && !list.some((y) => y.id === yearbookId)) {
        setYearbookId(list[0].id);
      }
    });
  }, [loadYears]);

  /**
   * Load labs whenever yearbookId/semester changes or reloadKey is incremented.
   */
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

  /**
   * Global refresh hook:
   * - Listens to "labs-updated" event (e.g., triggered after admin edits labs).
   * - Event detail may include { yearId, semester } to auto-select and reload.
   */
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

  /**
   * coursesList:
   * - Unique list of courses present in current labs data
   * - Used for course filter dropdown.
   */
  const coursesList = useMemo(() => {
    const m = new Map();
    labs.forEach((l) => m.set(l.courseCode, l.courseName));
    return Array.from(m.entries()).map(([code, name]) => ({ code, name }));
  }, [labs]);

  /**
   * grouped:
   * - Applies course filter
   * - Sorts by date (earliest first)
   * - Groups rows by courseCode
   */
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
        groups[l.courseCode] = {
          courseCode: l.courseCode,
          courseName: l.courseName,
          rows: [],
        };
      }
      groups[l.courseCode].rows.push(l);
    });

    return Object.values(groups);
  }, [labs, courseFilter]);

  return (
    <div className="max-w-250 mx-auto p-4 text-right dark:text-slate-100" dir="rtl">
      <header className="mb-6">
        <h2 className="text-3xl font-extrabold mb-1">🧪 לוח מעבדות</h2>
        <p className="text-gray-600 dark:text-slate-300">ריכוז כל מועדי המעבדות לפי קורס, תאריך וקבוצה</p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl dark:bg-slate-900 dark:border-slate-700">
        <select
          value={yearbookId}
          onChange={(e) => setYearbookId(e.target.value)}
          className="p-2 border rounded-md bg-white outline-none focus:ring-2 ring-blue-500 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
        >
          {(yearbooks.length ? yearbooks : [{ id: yearbookId, label: yearbookId }]).map((y) => (
            <option key={y.id} value={y.id}>{y.label}</option>
          ))}
        </select>

        <select
          value={semester}
          onChange={(e) => setSemester(Number(e.target.value))}
          className="p-2 border rounded-md bg-white outline-none focus:ring-2 ring-blue-500 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
        >
          {SEMESTERS.map((s) => <option key={s} value={s}>סמסטר {s}</option>)}
        </select>

        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="p-2 border rounded-md bg-white outline-none focus:ring-2 ring-blue-500 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
        >
          <option value="ALL">כל הקורסים</option>
          {coursesList.map((c) => (
            <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-blue-600 animate-pulse dark:text-blue-300">טוען נתונים…</div>}
      {error && <div className="text-red-600 font-bold dark:text-red-400">{error}</div>}
      {!loading && !error && grouped.length === 0 && (
        <div className="text-red-600 mt-4 dark:text-red-400">לא נמצאו נתונים</div>
      )}

      {/* Course Cards */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div
            key={group.courseCode}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm dark:bg-slate-950 dark:border-slate-700"
          >
            <div className="p-4 bg-slate-100 border-b border-gray-200 flex justify-between items-center dark:bg-slate-900 dark:border-slate-700">
              <div className="text-lg font-bold">
                📘 {group.courseCode}{" "}
                <span className="font-medium text-gray-500 dark:text-slate-400">– {group.courseName}</span>
              </div>
              <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold dark:bg-blue-900/40 dark:text-blue-200">
                {group.rows.length} מפגשים
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-212.5 text-sm text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    {["מפגש", "📅 תאריך", "יום", "⏰ שעה", "קבוצה", "👩‍🔬 צוות"].map((h) => (
                      <th key={h} className="p-3 border-l border-gray-100 last:border-l-0 dark:border-slate-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b last:border-0 dark:border-slate-800 ${
                        idx % 2 === 0
                          ? "bg-white dark:bg-slate-950"
                          : "bg-slate-50/50 dark:bg-slate-900/40"
                      }`}
                    >
                      <td className="p-3 text-center">{row.session}</td>
                      <td className="p-3 text-center font-bold tracking-tight">{formatDate(row.date)}</td>
                      <td className="p-3 text-center">{row.day}</td>
                      <td className="p-3 text-center text-blue-700 font-semibold dark:text-blue-300">{row.time}</td>
                      <td className="p-3 text-center">{row.group}</td>
                      <td className="p-3 text-gray-600 dark:text-slate-300">{row.staff?.join(", ")}</td>
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
