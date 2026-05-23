import { useEffect, useMemo, useState } from "react";
import UploadYearbook from "./UploadYearbook.jsx";
import UploadLabs from "./UploadLabs.jsx";
import AdminSecurity from "./AdminSecurityUI.jsx";
import AdminLogin from "./AdminLogin.jsx";
import AdminRegistrationGuidelines from "./AdminRegistrationGuidelines.jsx";
/**
 * AdminPanel.jsx
 * --------------
 * Main admin dashboard for BIO-BOT.
 *
 * Responsibilities:
 * - Admin authentication (via AdminLogin) + session persistence (sessionStorage)
 * - Admin security modal (AdminSecurityUI)
 * - Tabs UI for managing:
 *   1) Advisors (CRUD)
 *   2) Labs schedule (load / edit table / save)
 *   3) Yearbooks & required courses (CRUD)
 *   4) Registration guidelines (AdminRegistrationGuidelines)
 *
 * Data Flow:
 * - Uses `apiFetch()` wrapper for calling backend REST endpoints.
 * - Uses `toast()` to show global status feedback (idle / ok / error).
 * - Auto-loads data based on authentication and active tab.
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * apiFetch(path, options)
 * ----------------------
 * Small wrapper around fetch() to:
 * - Use API_BASE + path
 * - Default JSON headers
 * - Auto JSON.stringify(body)
 * - Throw a readable Error when the API fails
 *
 * 
 */
function getAdminToken() {
  try {
    return JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token ?? null;
  } catch {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  const token = getAdminToken();
  const res = await fetch(API_BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method: options.method || "GET",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "API error");
  }

  return data;
}

const EMPTY_LAB = {
  id: "",
  type: "",
  date: "",
  day: "",
  time: "",
  labGroup: "",
  lecturer: "",
};
const LAB_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

function Card({ children, className = "" }) {
  return (
    <div
      className={
        `bg-white border rounded-2xl shadow-sm ` +
        `dark:bg-slate-900 dark:border-slate-700 dark:shadow-black/20 ` +
        className
      }
    >
      {children}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">
        {label}
      </div>
      {children}
      {hint ? (
        <div className="text-[11px] text-gray-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Btn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "px-4 py-2 rounded-full text-xs font-semibold border transition " +
        "bg-white hover:bg-gray-50 active:scale-[0.99] " +
        "dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "px-4 py-2 rounded-full text-xs font-semibold transition " +
        "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99] " +
        "dark:bg-blue-500 dark:hover:bg-blue-600 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function DangerBtn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "px-4 py-2 rounded-full text-xs font-semibold transition " +
        "bg-red-600 text-white hover:bg-red-700 active:scale-[0.99] " +
        "dark:bg-red-500 dark:hover:bg-red-600 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export default function AdminPanel() {
  const [admin, setAdmin] = useState(() =>
    JSON.parse(sessionStorage.getItem("bio_admin") || "null")
  );

  const isAuthed = !!admin;
  const [showSecurity, setShowSecurity] = useState(false);
  const [activeTab, setActiveTab] = useState("advisors");
  const [status, setStatus] = useState({ type: "idle", msg: "" });

  // ---------- Advisors state ----------
  const [advisors, setAdvisors] = useState([]);
  const [advisorDraft, setAdvisorDraft] = useState(null);
  const [advisorSearch, setAdvisorSearch] = useState("");

  // ---------- Labs state ----------
  const [labYears, setLabYears] = useState([]);
  const [labSemesterId, setLabSemesterId] = useState("2");
  const [labYearbookId, setLabYearbookId] = useState("");

  const [labDoc, setLabDoc] = useState({
    yearbookId: "",
    semester: "",
    labs: [],
  });

  const [labLoading, setLabLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed) return;
    if (activeTab !== "labs") return;

    async function loadLabYears() {
      try {
        const data = await apiFetch("/api/labs-years");
        setLabYears(data.years || []);

        if (!labYearbookId && data.years?.length) {
          setLabYearbookId(data.years[0].id);
        }
      } catch (e) {
        toast("error", "⚠️ לא ניתן לטעון שנות מעבדה");
      }
    }

    loadLabYears();
  }, [isAuthed, activeTab]);

  // ---------- Yearbooks/Courses state ----------
  const [yearbooks, setYearbooks] = useState([]);
  const [ybId, setYbId] = useState("");
  const [semId, setSemId] = useState("semester_1");
  const [courses, setCourses] = useState([]);
  const [courseDraft, setCourseDraft] = useState(null);

  const toast = (type, msg) => setStatus({ type, msg });

  const handleLogout = () => {
    setAdmin(null);
    sessionStorage.removeItem("bio_admin");
  };

  // ---------- Load helpers ----------
  const loadAdvisors = async () => {
    toast("idle", "טוען יועצים...");
    try {
      const data = await apiFetch("/api/admin/advisors");
      setAdvisors(data.advisors || []);
      toast("ok", `✅ נטענו ${data.advisors?.length || 0} יועצים.`);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const loadYearbooks = async () => {
    try {
      const data = await apiFetch("/api/yearbooks");
      setYearbooks(data.yearbooks || []);
      if (!ybId && data.yearbooks?.length) setYbId(data.yearbooks[0].id);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const loadCourses = async () => {
    if (!ybId || !semId) return;
    toast("idle", "טוען קורסים...");
    try {
      const data = await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(
          ybId
        )}/requiredCourses/${encodeURIComponent(semId)}/courses`
      );
      setCourses(data.courses || []);
      toast("ok", `✅ נטענו ${data.courses?.length || 0} קורסים.`);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const normalizeLab = (lab = {}, courseCode = "", courseName = "") => ({
    ...EMPTY_LAB,
    courseCode,
    type: lab.session || courseName,
    date: lab.date ? lab.date.split("T")[0] : "",
    day: lab.day || "",
    time: lab.time || "",
    labGroup: lab.group ?? "",
    lecturer: Array.isArray(lab.staff) ? lab.staff.join(", ") : lab.staff || "",
  });

  const loadLab = async () => {
    setLabLoading(true);
    toast("idle", "טוען לוח מעבדה...");

    try {
      const data = await apiFetch(
        `/api/admin/labs/${encodeURIComponent(labYearbookId)}/${encodeURIComponent(
          labSemesterId
        )}`
      );

      const semesterDoc = data?.doc || {};
      let labs = [];

      if (semesterDoc.courses && typeof semesterDoc.courses === "object") {
        Object.entries(semesterDoc.courses).forEach(([courseCode, course]) => {
          const courseName = course.courseName || "";
          if (Array.isArray(course.labs)) {
            course.labs.forEach((lab) => {
              labs.push(normalizeLab(lab, courseCode, courseName));
            });
          }
        });
      }

      setLabDoc({
        yearbookId: labYearbookId,
        semester: labSemesterId,
        labs,
      });

      toast("ok", `✅ נטענו ${labs.length} שורות מעבדה.`);
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
      setLabDoc({
        yearbookId: labYearbookId,
        semester: labSemesterId,
        labs: [],
      });
    } finally {
      setLabLoading(false);
    }
  };

  // ---------- Auto-load when authenticated ----------
  useEffect(() => {
    if (!isAuthed) return;

    loadYearbooks();
    loadAdvisors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    if (activeTab !== "yearbooks") return;
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, activeTab, ybId, semId]);

  useEffect(() => {
    if (!isAuthed) return;
    if (activeTab !== "labs") return;
    if (!labYearbookId) return;
    loadLab();
  }, [isAuthed, activeTab, labYearbookId, labSemesterId]);

  const filteredAdvisors = useMemo(() => {
    const q = advisorSearch.trim();
    if (!q) return advisors;
    return advisors.filter((a) =>
      [a.id, a.name, a.email, (a.tracks || []).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [advisors, advisorSearch]);

  // ---------- Advisors CRUD ----------
  const newAdvisor = () => {
    setAdvisorDraft({
      id: "",
      name: "",
      email: "",
      lastNameRanges: ["א-ת"],
      semesters: [1],
      tracks: ["כללי"],
    });
  };

  const editAdvisor = (a) => setAdvisorDraft({ ...a });

  const saveAdvisor = async () => {
    try {
      if (!advisorDraft?.id) return toast("error", "חובה להזין ID ליועץ.");
      await apiFetch(`/api/admin/advisors/${encodeURIComponent(advisorDraft.id)}`, {
        method: "POST",
        body: advisorDraft,
      });
      toast("ok", "✅ היועץ נשמר.");
      setAdvisorDraft(null);
      loadAdvisors();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const deleteAdvisor = async (id) => {
    if (!confirm("למחוק יועץ?")) return;
    try {
      await apiFetch(`/api/admin/advisors/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast("ok", "🗑️ היועץ נמחק.");
      loadAdvisors();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  // ---------- Labs CRUD ----------
  const saveLab = async () => {
    try {
      const existing = await apiFetch(`/api/admin/labs/${labYearbookId}/${labSemesterId}`);
      const semesterDoc = existing?.doc || {};
      const courses = { ...(semesterDoc.courses || {}) };

      Object.values(courses).forEach((c) => {
        c.labs = [];
      });

      labDoc.labs.forEach((lab) => {
        if (!lab.courseCode || !courses[lab.courseCode]) return;

        courses[lab.courseCode].labs.push({
          session: lab.session || lab.type,
          group: lab.labGroup,
          date: lab.date,
          day: lab.day,
          time: lab.time,
          staff: lab.lecturer ? lab.lecturer.split(",").map((s) => s.trim()) : [],
        });
      });

      await apiFetch(`/api/admin/labs/${labYearbookId}/${labSemesterId}`, {
        method: "PUT",
        body: { courses },
      });

      toast("ok", "✅ לוח המעבדות נשמר בהצלחה");
      loadLab();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const updateLab = (index, field, value) => {
    const copy = [...labDoc.labs];
    copy[index] = { ...copy[index], [field]: value };
    setLabDoc({ ...labDoc, labs: copy });
  };

  const addLabRow = () => {
    setLabDoc({
      ...labDoc,
      labs: [...labDoc.labs, { ...EMPTY_LAB }],
    });
  };

  const removeLabRow = (index) => {
    setLabDoc({
      ...labDoc,
      labs: labDoc.labs.filter((_, i) => i !== index),
    });
  };

  // ---------- Yearbooks/Courses CRUD ----------
  const newCourse = () => {
    setCourseDraft({
      courseCode: "",
      courseName: "",
      lectureHours: null,
      practiceHours: null,
      labHours: null,
      credits: null,
      relations: [],
    });
  };

  const editCourse = (c) => {
    setCourseDraft({
      courseCode: c.courseCode || c.id || "",
      courseName: c.courseName || "",
      lectureHours: c.lectureHours ?? null,
      practiceHours: c.practiceHours ?? null,
      labHours: c.labHours ?? null,
      credits: c.credits ?? null,
      relations: Array.isArray(c.relations) ? c.relations : [],
    });
  };

  const saveCourse = async () => {
    try {
      if (!courseDraft?.courseCode) return toast("error", "חובה להזין קוד קורס.");
      await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(
          ybId
        )}/requiredCourses/${encodeURIComponent(semId)}/courses/${encodeURIComponent(
          courseDraft.courseCode
        )}`,
        { method: "PUT", body: courseDraft }
      );
      toast("ok", "✅ הקורס נשמר.");
      setCourseDraft(null);
      loadCourses();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const deleteCourse = async (courseCode) => {
    if (!confirm("למחוק קורס? (כולל relations)")) return;
    try {
      await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(
          ybId
        )}/requiredCourses/${encodeURIComponent(semId)}/courses/${encodeURIComponent(
          courseCode
        )}`,
        { method: "DELETE" }
      );
      toast("ok", "🗑️ הקורס נמחק.");
      loadCourses();
    } catch (e) {
      toast("error", `⚠️ ${e.message}`);
    }
  };

  const addRelation = () => {
    setCourseDraft((p) => ({
      ...p,
      relations: [...(p.relations || []), { courseCode: "", courseName: "", type: "PREREQUISITE" }],
    }));
  };

  const updateRelation = (index, field, value) => {
    setCourseDraft((p) => {
      const copy = [...(p.relations || [])];
      copy[index] = { ...copy[index], [field]: value };
      return { ...p, relations: copy };
    });
  };

  const removeRelation = (index) => {
    setCourseDraft((p) => ({
      ...p,
      relations: p.relations.filter((_, i) => i !== index),
    }));
  };

  // ---------- UI ----------
return (
  <div
    className="max-w-6xl mx-auto px-4 md:px-8 py-8 text-right text-gray-900 dark:text-slate-100"
    dir="rtl"
  >
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="space-y-1">
        <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
          אזור מנהל
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-300">
         הנחיות רישום · ניהול יועצים · לוחות מעבדה · שנתון וקורסים
        </div>
      </div>
    </div>

    <Card className="p-4 w-[320px] dark:bg-slate-900 dark:border-slate-700">
      {!isAuthed ? (
        <AdminLogin
          onSuccess={(adminData) => {
            setAdmin(adminData);
            sessionStorage.setItem("bio_admin", JSON.stringify(adminData));
          }}
        />
      ) : (
        <div className="space-y-3 text-center">
          <div className="text-sm font-semibold text-green-700 dark:text-emerald-300">
            מחובר כמנהל  ✅
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{admin.email}</div>

          <button
            className="w-full bg-gray-100 dark:bg-slate-800 dark:text-slate-100 rounded-lg py-2 text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition"
            onClick={() => setShowSecurity(true)}
          >
            ⚙️ הגדרות אבטחה
          </button>

          <button
            className="w-full bg-red-600 dark:bg-red-500 text-white rounded-lg py-2 text-sm hover:bg-red-700 dark:hover:bg-red-600 transition"
            onClick={handleLogout}
          >
            התנתקות
          </button>
        </div>
      )}
    </Card>

    {showSecurity && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-xl w-96 p-6 relative border border-gray-200 dark:border-slate-700">
          <button
            className="absolute top-3 left-3 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            onClick={() => setShowSecurity(false)}
          >
            ✖
          </button>

          <AdminSecurity adminUid={admin.uid} adminEmail={admin.email} />
        </div>
      </div>
    )}

    {/* Status */}
    {isAuthed && status.msg && (
      <div
        className={
          "mt-4 text-sm rounded-2xl border px-4 py-3 " +
          (status.type === "error"
            ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
            : status.type === "ok"
            ? "bg-green-50 border-green-200 text-green-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200"
            : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200")
        }
      >
        {status.msg}
      </div>
    )}

    {!isAuthed ? (
      <div className="mt-6 text-sm text-gray-600 dark:text-slate-300"></div>
    ) : (
      <>
        {/* Tabs */}
        <div className="mt-6 flex gap-2 flex-wrap">
          <Btn
            className={
              activeTab === "advisors"
                ? "border-blue-600 text-blue-700 bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:bg-blue-900/20"
                : "border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-200"
            }
            onClick={() => setActiveTab("advisors")}
          >
            👨‍🏫 יועצים
          </Btn>

          <Btn
            className={
              activeTab === "labs"
                ? "border-blue-600 text-blue-700 bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:bg-blue-900/20"
                : "border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-200"
            }
            onClick={() => setActiveTab("labs")}
          >
            🧪 לוחות מעבדה
          </Btn>

          <Btn
            className={
              activeTab === "yearbooks"
                ? "border-blue-600 text-blue-700 bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:bg-blue-900/20"
                : "border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-200"
            }
            onClick={() => setActiveTab("yearbooks")}
          >
            📚 שנתון / קורסי חובה
          </Btn>

          <Btn
            className={
              activeTab === "registration"
                ? "border-blue-600 text-blue-700 bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:bg-blue-900/20"
                : "border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-200"
            }
            onClick={() => setActiveTab("registration")}
          >
            📝 הנחיות רישום
          </Btn>
        </div>

        {/* Content */}
        <div
          className={`mt-4 grid grid-cols-1 gap-4 ${
            activeTab === "labs" || activeTab === "yearbooks" || activeTab === "registration"
              ? "lg:grid-cols-1"
              : "lg:grid-cols-3"
          }`}
        >
          {/* Left / main */}
          <div
            className={`space-y-4 ${
              activeTab === "labs" || activeTab === "yearbooks" || activeTab === "registration"
                ? ""
                : "lg:col-span-2"
            }`}
          >
            {activeTab === "advisors" && (
              <Card className="p-4 dark:bg-slate-900 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-lg font-bold text-gray-800 dark:text-slate-100">יועצים</div>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      className="border rounded-full px-3 py-2 text-xs w-60 bg-white text-gray-900 placeholder:text-gray-400
                                 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700"
                      placeholder="חיפוש לפי שם / מייל / הערה..."
                      value={advisorSearch}
                      onChange={(e) => setAdvisorSearch(e.target.value)}
                    />
                    <PrimaryBtn onClick={newAdvisor}>➕ יועץ חדש</PrimaryBtn>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-600 border-b dark:text-slate-300 dark:border-slate-800">
                        <th className="text-right py-2">ID</th>
                        <th className="text-right py-2">שם</th>
                        <th className="text-right py-2">מייל</th>
                        <th className="text-right py-2">סמסטרים</th>
                        <th className="text-right py-2">מסלולים</th>
                        <th className="text-right py-2">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdvisors.map((a) => (
                        <tr key={a.id} className="border-b last:border-b-0 dark:border-slate-800">
                          <td className="py-2 font-mono">{a.id}</td>
                          <td className="py-2">{a.name}</td>
                          <td className="py-2">{a.email}</td>
                          <td className="py-2">{(a.semesters || []).join(", ")}</td>
                          <td className="py-2">{(a.tracks || []).join(" / ")}</td>
                          <td className="py-2">
                            <div className="flex gap-2 flex-wrap">
                              <Btn
                                className="border-blue-200 text-blue-700 dark:border-blue-700/60 dark:text-blue-200"
                                onClick={() => editAdvisor(a)}
                              >
                                עריכה
                              </Btn>
                              <DangerBtn onClick={() => deleteAdvisor(a.id)}>מחיקה</DangerBtn>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredAdvisors.length ? (
                        <tr>
                          <td className="py-3 text-gray-500 dark:text-slate-400" colSpan={6}>
                            אין נתונים
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "registration" && (
              <Card className="p-4 dark:bg-slate-900 dark:border-slate-700">
                <AdminRegistrationGuidelines apiFetch={apiFetch} toast={toast} />
              </Card>
            )}

            {activeTab === "yearbooks" && (
              <>
                <UploadYearbook />
                <Card className="p-4 dark:bg-slate-900 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-lg font-bold text-gray-800 dark:text-slate-100">
                      שנתון / קורסי חובה
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Btn onClick={loadCourses}>רענון</Btn>
                      <PrimaryBtn onClick={newCourse}>➕ קורס חדש</PrimaryBtn>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="שנתון ">
                      <select
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={ybId}
                        onChange={(e) => setYbId(e.target.value)}
                      >
                        {yearbooks.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.label || y.id}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="סמסטר ">
                      <select
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={semId}
                        onChange={(e) => setSemId(e.target.value)}
                      >
                        {Array.from({ length: 8 }).map((_, i) => {
                          const n = i + 1;
                          const key = `semester_${n}`;
                          return (
                            <option key={key} value={key}>
                              {key}
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-600 border-b dark:text-slate-300 dark:border-slate-800">
                          <th className="text-right py-2">קוד</th>
                          <th className="text-right py-2">שם קורס</th>
                          <th className="text-right py-2">שעות</th>
                          <th className="text-right py-2">נ״ז</th>
                          <th className="text-right py-2">Relations</th>
                          <th className="text-right py-2">פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((c) => (
                          <tr key={c.courseCode} className="border-b last:border-b-0 dark:border-slate-800">
                            <td className="py-2 font-mono">{c.courseCode}</td>
                            <td className="py-2">{c.courseName}</td>
                            <td className="py-2">
                              ה:{c.lectureHours ?? "—"} · ת:{c.practiceHours ?? "—"} · מ:{c.labHours ?? "—"}
                            </td>
                            <td className="py-2">{c.credits ?? "—"}</td>
                            <td className="py-2 text-[11px] text-gray-700 dark:text-slate-300">
                              {(c.relations || []).length
                                ? (c.relations || [])
                                    .map(
                                      (r) =>
                                        `${r.type === "PREREQUISITE" ? "קדם" : "צמוד"}: ${r.courseCode}`
                                    )
                                    .join(" | ")
                                : "—"}
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2 flex-wrap">
                                <Btn
                                  className="border-blue-200 text-blue-700 dark:border-blue-700/60 dark:text-blue-200"
                                  onClick={() => editCourse(c)}
                                >
                                  עריכה
                                </Btn>
                                <DangerBtn onClick={() => deleteCourse(c.courseCode)}>מחיקה</DangerBtn>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!courses.length ? (
                          <tr>
                            <td className="py-3 text-gray-500 dark:text-slate-400" colSpan={6}>
                              אין קורסים להצגה
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {activeTab === "labs" && (
              <>
                <UploadLabs onUploadSuccess={loadLab} />

                <Card className="p-4 dark:bg-slate-900 dark:border-slate-700">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <div className="text-lg font-bold text-gray-800 dark:text-slate-100">עריכת לוחות מעבדה</div>
                    <div className="flex gap-2 flex-wrap">
                      <Btn onClick={loadLab}>רענון</Btn>
                      <PrimaryBtn onClick={saveLab} className="bg-green-600 hover:bg-green-700 dark:bg-emerald-500 dark:hover:bg-emerald-600">
                        💾 שמירת כל השינויים
                      </PrimaryBtn>
                    </div>
                  </div>

                  {/* Yearbook / Semester Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 bg-gray-50 p-3 rounded-xl dark:bg-slate-950 dark:border dark:border-slate-800">
                    <Field label="שנתון">
                      <select
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
                        value={labYearbookId}
                        onChange={(e) => setLabYearbookId(e.target.value)}
                      >
                        {labYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.label}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="סמסטר">
                      <select
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
                        value={labSemesterId}
                        onChange={(e) => setLabSemesterId(e.target.value)}
                      >
                        {LAB_SEMESTERS.map((s) => (
                          <option key={s} value={String(s)}>סמסטר {s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  {/* Table Section */}
                  {labLoading ? (
                    <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400 animate-pulse">
                      טוען נתוני מעבדות...
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-200 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800">
                            <th className="p-2 text-right w-24">קוד קורס*</th>
                            <th className="p-2 text-right">סוג / שם</th>
                            <th className="p-2 text-right w-32">תאריך</th>
                            <th className="p-2 text-right w-12">יום</th>
                            <th className="p-2 text-right w-20">שעה</th>
                            <th className="p-2 text-right w-16">קבוצה</th>
                            <th className="p-2 text-right">מרצה/סגל</th>
                            <th className="p-2 text-center w-10"></th>
                          </tr>
                        </thead>

                        <tbody>
                          {labDoc.labs.length ? (
                            labDoc.labs.map((lab, i) => (
                              <tr
                                key={i}
                                className="border-b hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <td className="p-1">
                                  <input
                                    className="border rounded px-2 py-1 w-full font-mono bg-white focus:ring-1 focus:ring-blue-400 outline-none
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    value={lab.courseCode || ""}
                                    placeholder="קוד"
                                    onChange={(e) => updateLab(i, "courseCode", e.target.value)}
                                  />
                                </td>

                                <td className="p-1">
                                  <input
                                    className="border rounded px-2 py-1 w-full bg-white
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    value={lab.type || ""}
                                    placeholder="למשל: בטיחות"
                                    onChange={(e) => updateLab(i, "type", e.target.value)}
                                  />
                                </td>

                                <td className="p-1">
                                  <input
                                    type="text"
                                    className="border rounded px-2 py-1 w-full bg-white text-right font-mono
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    placeholder="DD/MM/YYYY"
                                    value={lab.date || ""}
                                    onChange={(e) => updateLab(i, "date", e.target.value)}
                                  />
                                </td>

                                <td className="p-1">
                                  <input
                                    className="border rounded px-2 py-1 w-full text-center bg-white
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    value={lab.day}
                                    placeholder="א'"
                                    onChange={(e) => updateLab(i, "day", e.target.value)}
                                  />
                                </td>

                                <td className="p-1">
                                  <input
                                    type="text"
                                    className="border rounded px-2 py-1 w-full bg-white font-mono
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    value={lab.time}
                                    placeholder="HH:mm"
                                    onChange={(e) => updateLab(i, "time", e.target.value)}
                                  />
                                </td>

                                <td className="p-1">
                                  <input
                                    className="border rounded px-2 py-1 w-full text-center bg-white
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    value={lab.labGroup}
                                    placeholder="1"
                                    onChange={(e) => updateLab(i, "labGroup", e.target.value)}
                                  />
                                </td>

                                <td className="p-1">
                                  <input
                                    className="border rounded px-2 py-1 w-full bg-white
                                               dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                                    value={lab.lecturer}
                                    placeholder="שמות מרצים..."
                                    onChange={(e) => updateLab(i, "lecturer", e.target.value)}
                                  />
                                </td>

                                <td className="p-1 text-center">
                                  <button
                                    onClick={() => removeLabRow(i)}
                                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1"
                                    title="מחק שורה"
                                  >
                                    🗑
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-gray-400 dark:text-slate-500 italic">
                                אין נתונים להצגה. לחצי על "הוספת שורה" כדי להתחיל.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-6 flex items-center justify-between border-t pt-4 dark:border-slate-800">
                    <Btn onClick={addLabRow} className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-500/60 dark:text-blue-200 dark:hover:bg-blue-900/20">
                      ➕ הוספת שורה חדשה
                    </Btn>

                    <div className="text-[10px] text-gray-400 dark:text-slate-500 italic">
                      * שים לב: קוד קורס חייב להתאים לקורס קיים בשנתון כדי שהנתונים יישמרו.
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Right / editor */}
          <div className="space-y-4">
            {activeTab === "advisors" && (
              <Card className="p-4 dark:bg-slate-900 dark:border-slate-700">
                <div className="text-sm font-bold text-gray-800 dark:text-slate-100">עריכת יועץ</div>
                {!advisorDraft ? (
                  <div className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                    בחרי יועץ לעריכה או לחצי “יועץ חדש”.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <Field label="ID (חובה)">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={advisorDraft.id}
                        onChange={(e) => setAdvisorDraft((p) => ({ ...p, id: e.target.value }))}
                        placeholder='למשל: "ADVISOR_7"'
                      />
                    </Field>

                    <Field label="שם">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={advisorDraft.name}
                        onChange={(e) => setAdvisorDraft((p) => ({ ...p, name: e.target.value }))}
                      />
                    </Field>

                    <Field label="מייל">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={advisorDraft.email}
                        onChange={(e) => setAdvisorDraft((p) => ({ ...p, email: e.target.value }))}
                      />
                    </Field>

                    <Field
                      label="טווח אותיות (lastNameRanges)"
                      hint='דוגמה: ["א-כ"] או ["ל-ת"] או ["א-ת"]'
                    >
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={(advisorDraft.lastNameRanges || []).join(", ")}
                        onChange={(e) =>
                          setAdvisorDraft((p) => ({
                            ...p,
                            lastNameRanges: e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          }))
                        }
                      />
                    </Field>

                    <Field label="סמסטרים (semesters)" hint='דוגמה: "1,2" או "5,6,7,8"'>
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={(advisorDraft.semesters || []).join(",")}
                        onChange={(e) =>
                          setAdvisorDraft((p) => ({
                            ...p,
                            semesters: e.target.value
                              .split(",")
                              .map((x) => parseInt(x.trim(), 10))
                              .filter((n) => !Number.isNaN(n)),
                          }))
                        }
                      />
                    </Field>

                    <Field
                      label="מסלולים (tracks)"
                      hint='דוגמה: "כללי" או "מולקולרית-תרופתית" או "מזון והסביבה"'
                    >
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={(advisorDraft.tracks || []).join(", ")}
                        onChange={(e) =>
                          setAdvisorDraft((p) => ({
                            ...p,
                            tracks: e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          }))
                        }
                      />
                    </Field>
                    <div className="flex gap-2 flex-wrap">
                      <PrimaryBtn onClick={saveAdvisor}>שמירה</PrimaryBtn>
                      <Btn onClick={() => setAdvisorDraft(null)}>סגירה</Btn>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* "registration" tab content is rendered in the left/main column to avoid an empty right column */}
            {activeTab === "yearbooks" && courseDraft && (
              <Card className="p-4 dark:bg-slate-900 dark:border-slate-700">
                <div className="mt-3 space-y-3">
                  <Field label="קוד קורס (חובה)">
                    <input
                      className="w-full border rounded-xl px-3 py-2 text-sm font-mono bg-white
                                 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                      value={courseDraft.courseCode}
                      onChange={(e) => setCourseDraft((p) => ({ ...p, courseCode: e.target.value }))}
                      placeholder='למשל: "41012"'
                    />
                  </Field>

                  <Field label="שם קורס">
                    <input
                      className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                      value={courseDraft.courseName}
                      onChange={(e) => setCourseDraft((p) => ({ ...p, courseName: e.target.value }))}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="שעות הרצאה (lectureHours)">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={courseDraft.lectureHours ?? ""}
                        onChange={(e) =>
                          setCourseDraft((p) => ({
                            ...p,
                            lectureHours: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="שעות תרגול (practiceHours)">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={courseDraft.practiceHours ?? ""}
                        onChange={(e) =>
                          setCourseDraft((p) => ({
                            ...p,
                            practiceHours: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="שעות מעבדה (labHours)">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={courseDraft.labHours ?? ""}
                        onChange={(e) =>
                          setCourseDraft((p) => ({
                            ...p,
                            labHours: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="נ״ז (credits)">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white
                                   dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                        value={courseDraft.credits ?? ""}
                        onChange={(e) =>
                          setCourseDraft((p) => ({
                            ...p,
                            credits: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Relations (קשרי קורסים)">
                    <div className="space-y-2">
                      {(courseDraft.relations || []).map((r, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            className="col-span-3 border rounded px-2 py-1 text-xs bg-white
                                       dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                            value={r.type}
                            onChange={(e) => updateRelation(i, "type", e.target.value)}
                          >
                            <option value="PREREQUISITE">קורס קדם</option>
                            <option value="COREQUISITE">קורס צמוד</option>
                          </select>

                          <input
                            className="col-span-3 border rounded px-2 py-1 text-xs font-mono bg-white
                                       dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                            placeholder="קוד קורס"
                            value={r.courseCode}
                            onChange={(e) => updateRelation(i, "courseCode", e.target.value)}
                          />

                          <input
                            className="col-span-4 border rounded px-2 py-1 text-xs bg-white
                                       dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700"
                            placeholder="שם הקורס"
                            value={r.courseName}
                            onChange={(e) => updateRelation(i, "courseName", e.target.value)}
                          />

                          <DangerBtn className="col-span-2" onClick={() => removeRelation(i)}>
                            🗑
                          </DangerBtn>
                        </div>
                      ))}

                      <Btn onClick={addRelation}>➕ הוספת Relation</Btn>
                    </div>
                  </Field>

                  <div className="flex gap-2 flex-wrap">
                    <PrimaryBtn onClick={saveCourse}>שמירה</PrimaryBtn>
                    <Btn onClick={() => setCourseDraft(null)}>סגירה</Btn>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </>
    )}
  </div>
);
}