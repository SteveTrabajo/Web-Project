
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ChatBot.jsx (BIO-BOT)
 * --------------------
 * Student chat UI:
 * - Guided flow: yearbook -> topic -> semester -> (advisor letter -> track)
 * - Free-text questions sent to backend (/api/ask)
 * - Course autocomplete (/api/courses/suggest)
 * - Renders bot HTML via dangerouslySetInnerHTML (backend must sanitize HTML)
 *
 * Backend endpoints:
 * - GET  /api/yearbooks
 * - GET  /api/courses/suggest?yearbookId=&q=
 * - POST /api/ask  { yearbookId, question }
 * - GET  /api/requiredcourses/:yearbookId/semester_:n
 * - GET  /api/advisor?lastNameLetter=&semester=&track=
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";

const TRACKS = ["מולקולרית-תרופתית", "מזון והסביבה"];
const HEB_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];

const SECRETARY_PHONE = "04-9901927";
const SECRETARY_EMAIL = "nataliav@braude.ac.il";
const EXCEPTION_FORM_URL = `${API_BASE}/files/טופס_רישום_או_ביטול_קורס.doc`;
const ADVISOR_FORM_URL = `${API_BASE}/files/טופס_ייעוץ_לסטודנט.docx`;

export default function ChatBot() {
    // messages: [{id, sender:"user"|"bot", html:string}]  (bot uses HTML bubbles)

  const [messages, setMessages] = useState([]);
  // input: free text input value
  const [input, setInput] = useState("");
    // context: drives guided UI state (yearbook/topic/semester/advisor filters)
  const [context, setContext] = useState({
    yearbook: null,
    semesterNum: null,
    semesterKey: null,
    topic: null, // null | "courses" | "advisor" | "advisor_input" | "track_input"
    lastNameLetter: null,
    track: null,
  });

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = async (val) => {
    if (val.length < 2 || !context.yearbook) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/courses/suggest?yearbookId=${context.yearbook}&q=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (e) {
      console.error("Suggestions error:", e);
    }
  };

  const chatRef = useRef(null);
  const [yearbooks, setYearbooks] = useState([]);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    startChat();
    loadYearbooks();
  }, []);

  const addBot = (html) => setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "bot", html }]);
  const addUser = (text) => setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "user", html: text }]);

  const startChat = () => {
    setMessages([]);
    setContext({ yearbook: null, semesterNum: null, semesterKey: null, topic: null, lastNameLetter: null, track: null });
   addBot(`
  <div class="space-y-2">
    <div class="text-xl font-bold text-[#162A5A] dark:text-sky-300">👋 ברוכים הבאים ל-BIO BOT</div>
    <p class="text-gray-700 dark:text-slate-200">אני כאן כדי לעזור לך עם מידע אקדמי, קורסים וייעוץ במחלקה.</p>
    <div class="text-sm font-semibold text-blue-600 dark:text-sky-300 mt-4 font-sans">
      אנא בחר באיזה שנת לימודים התחלת כדי לעזור לך
    </div>
  </div>
`);

  };

  const loadYearbooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/yearbooks`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.yearbooks)) setYearbooks(data.yearbooks);
    } catch (e) {
      addBot("<div class='text-red-500 font-sans'>⚠️ תקלה בחיבור לשרת הנתונים.</div>");
    }
  };

  const sendMessage = async () => {
    const q = input.trim();
    if (!q) return;

    // סגירת הצעות מיד עם השליחה
    setSuggestions([]);
    setShowSuggestions(false);

    if (!context.yearbook) {
      addBot(`<div class="text-amber-600 font-medium italic font-sans">⚠️ יש לבחור שנתון מהרשימה לפני שניתן לשאול שאלות.</div>`);
      return;
    }
    addUser(q);
    setInput("");
    const loadingId = crypto.randomUUID();
    setMessages((p) => [...p, { id: loadingId, sender: "bot", html: "⏳ רגע אני חושב…"  }]);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearbookId: context.yearbook, question: q }),
      });
      const data = await res.json();
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      addBot(data.html || "לא נמצאה תשובה בבסיס הנתונים.");
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      addBot("<div class='font-sans'>⚠️ שגיאת שרת.</div>");
    }
  };

  const chooseYearbook = (y) => {
    addUser(y.label);
    setContext((p) => ({ ...p, yearbook: y.id }));
  };

  const chooseTopic = (t) => {
    const labels = { courses: "📚 קורסי חובה", advisor: "👨‍🏫 יועץ אקדמי", exceptional: "📝 רישום חריג" };
    addUser(labels[t]);
    if (t === "exceptional") {
      showExceptionalRegistration();
    } else {
      setContext((p) => ({ ...p, topic: t }));
      addBot("<b class='font-sans'>בחר/י סמסטר:</b>");
    }
  };

  const chooseSemester = (n) => {
    addUser(`סמסטר ${n}`);
    const updated = { ...context, semesterNum: n, semesterKey: `semester_${n}` };
    setContext(updated);
    if (context.topic === "courses") loadRequiredCourses(updated.yearbook, n);
    else if (context.topic === "advisor") {
      addBot("<b class='font-sans'>מה האות הראשונה של שם המשפחה?</b>");
      setContext((p) => ({ ...p, topic: "advisor_input", semesterNum: n }));
    }
  };

  const loadRequiredCourses = async (yb, sem) => {
    addBot("<div class='font-sans'>🔄 שולף נתונים מהשנתון...</div>");
    try {
      const res = await fetch(`${API_BASE}/api/requiredcourses/${yb}/semester_${sem}`);
      const data = await res.json();
      if (!res.ok || !data.courses?.length) return addBot("<div class='font-sans'>❌ לא נמצאו קורסים.</div>");

     let html = `
  <div class="space-y-4 font-sans">
    <div class="text-lg font-bold text-[#162A5A] dark:text-sky-300">
      סמסטר ${sem} - קורסי חובה
    </div>
`;

data.courses.forEach((c) => {
  html += `
    <div class="
      rounded-2xl border-r-4 border-[#162A5A]
      p-4 shadow-sm border
      bg-white
      text-gray-900
      dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100
    ">
      <div class="font-bold">${c.courseName}</div>

      <div class="text-xs font-mono mt-1 text-gray-500 dark:text-slate-300">
        ${c.courseCode} | ${c.credits} נ״ז
      </div>

      ${
        c.relations?.length
          ? `
          <div class="mt-2 text-xs space-y-1">
            ${c.relations
              .map(
                (r) => `
              <div class="
                italic font-bold
                ${
                  r.type === "PREREQUISITE"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-300"
                }
              ">
                • ${r.type === "PREREQUISITE" ? "קדם" : "צמוד"}: ${r.courseName}
              </div>
            `
              )
              .join("")}
          </div>
        `
          : ""
      }
    </div>
  `;
});

addBot(html + "</div>");

    } catch (e) { addBot("<div class='font-sans'>⚠️ שגיאה.</div>"); }
  };

  const chooseLetter = (L) => {
    addUser(L);
    if (context.semesterNum >= 5) {
      setContext(p => ({ ...p, lastNameLetter: L, topic: "track_input" }));
      addBot("<b class='font-sans'>בחר התמחות:</b>");
    } else {
      loadAdvisor(L, context.semesterNum, null);
    }
  };

  const loadAdvisor = async (letter, sem, track) => {
    // מנקים את ה-topic מיד כדי שהמקלדת תיעלם בזמן הטעינה או מיד אחריה
    setContext(p => ({ ...p, topic: "advisor" }));

    try {
      const params = new URLSearchParams({ lastNameLetter: letter, semester: String(sem) });
      if (track) params.set("track", track);

      const res = await fetch(`${API_BASE}/api/advisor?${params}`);
      const data = await res.json();
      const a = data.advisors?.[0];

      if (a) {
       addBot(`
  <div class="
    p-4 rounded-2xl border space-y-2 font-sans
    bg-blue-50 border-blue-100
    dark:bg-slate-900 dark:border-slate-700
  ">
    <div class="font-bold text-[#162A5A] dark:text-sky-300">👨‍🏫 היועץ האקדמי שלך:</div>

    <div class="text-sm text-gray-800 dark:text-slate-100">
      <b>שם:</b> ${a.name}
    </div>

    <div class="text-sm text-gray-800 dark:text-slate-100">
      <b>מייל:</b>
      <a href="mailto:${a.email}" class="text-blue-700 underline dark:text-sky-300">
        ${a.email}
      </a>
    </div>

    <div class="
      mt-2 text-xs p-2 rounded border
      bg-white border-blue-50 text-gray-700
      dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200
    ">
      זכור למלא
      <a href="${ADVISOR_FORM_URL}" class="underline font-bold text-blue-700 dark:text-sky-300">
        טופס ייעוץ
      </a>
      לפני הפנייה.
    </div>
  </div>
`);

      } else {
        addBot("<div class='font-sans text-red-500'>❌ לא נמצא יועץ מתאים לאות זו.</div>");
      }
    } catch (e) {
      addBot("<div class='font-sans'>⚠️ שגיאה בחיבור לשרת.</div>");
    }
  };

  const showExceptionalRegistration = () => {
    addBot(`
  <div class="
    rounded-2xl p-5 shadow-sm space-y-4
    bg-white border border-blue-100
    text-gray-800
    dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100
  ">
    <div class="text-lg font-bold text-blue-700 dark:text-sky-300">📝 רישום או ביטול חריג לקורסים</div>

    <div class="text-sm text-gray-800 dark:text-slate-200">
      משתמשים ברישום חריג כאשר <strong>לא ניתן להירשם לקורס דרך תחנת מידע</strong>.
    </div>

    <div class="
      rounded-xl p-3 text-sm space-y-1
      bg-blue-50 border border-blue-200
      dark:bg-slate-950 dark:border-slate-700
    ">
      <div class="font-semibold mb-1 dark:text-slate-100">מתי זה קורה בדרך כלל?</div>
      <div>❌ אין מקום פנוי בקורס</div>
      <div>📉 נכשלת בקורס פעמיים</div>
      <div>⏰ מועד הרישום/הביטול הסתיים</div>
    </div>

    <div class="
      rounded-xl p-3 text-sm space-y-2
      border border-gray-200 bg-white
      dark:bg-slate-950 dark:border-slate-700
    ">
    <div
  dir="rtl"
  class="
    rounded-xl p-4 text-sm space-y-3
    border border-gray-200 bg-white
    text-right
    dark:bg-slate-950 dark:border-slate-700
  "
>
  <div
  dir="rtl"
  class="
    rounded-xl p-4 text-sm space-y-4
    border border-gray-200 bg-white
    text-right
    dark:bg-slate-950 dark:border-slate-700
  "
>
  <div class="font-semibold mb-2 text-base">
  תהליך הגשת בקשה לרישום חריג:
</div>

<div class="flex items-start gap-3">
  <span
    class="
      shrink-0 w-8 h-8 flex items-center justify-center
      rounded-md bg-blue-600 text-white text-sm font-bold
    "
  >
    1
  </span>
  <span>מורידים את הטופס.</span>
</div>

<div class="flex items-start gap-3">
  <span
    class="
      shrink-0 w-8 h-8 flex items-center justify-center
      rounded-md bg-blue-600 text-white text-sm font-bold
    "
  >
    2
  </span>
  <span>ממלאים פרטי הקורס והסיבה לבקשה.</span>
</div>

<div class="flex items-start gap-3">
  <span
    class="
      shrink-0 w-8 h-8 flex items-center justify-center
      rounded-md bg-blue-600 text-white text-sm font-bold
    "
  >
    3
  </span>
  <span>שולחים מייל מנומס ליועץ ומסבירים את הבקשה שלכם כולל צירוף הטופס.</span>
</div>

<div class="flex items-start gap-3">
  <span
    class="
      shrink-0 w-8 h-8 flex items-center justify-center
      rounded-md bg-blue-600 text-white text-sm font-bold
    "
  >
    4
  </span>
  <span>היועץ מאשר/דוחה את הבקשה וממשיך את הטיפול.</span>
</div>




    <div class="border-t border-gray-200 pt-3 text-sm space-y-2 dark:border-slate-700">
      <div>
        📄 <strong>טופס רישום/ביטול קורס:</strong><br/>
        👉 <a href="${EXCEPTION_FORM_URL}" class="underline text-blue-700 dark:text-sky-300" target="_blank" rel="noreferrer">
          להורדת הטופס
        </a>
      </div>

      <div class="text-gray-700 dark:text-slate-200">
        📞 <strong>מזכירות:</strong> ${SECRETARY_PHONE}<br/>
        ✉️ <strong>מייל:</strong>
        <a class="underline text-blue-700 dark:text-sky-300" href="mailto:${SECRETARY_EMAIL}">
          ${SECRETARY_EMAIL}
        </a>
      </div>
    </div>
  </div>
`);

  };

  // ✅ UPDATED: dark variants for buttons
  const pillBtn =
    "px-4 py-2 rounded-full border border-blue-500 bg-white text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm active:scale-95 font-sans " +
    "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-800";

  const letterBtn =
    "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:border-[#162A5A] hover:text-[#162A5A] transition-all text-sm font-bold font-sans shadow-sm " +
    "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:border-blue-400 dark:hover:text-blue-300";

  return (
    <div
      className="
        w-full max-w-6xl mx-auto h-[85vh]
        bg-white text-slate-900 rounded-xl shadow-2xl border border-gray-200
        dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700
        flex flex-col overflow-hidden font-sans
      "
      dir="rtl"
    >
      {/* Header */}
      <div className="bg-[#162A5A] text-white px-8 py-5 flex flex-row-reverse items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-bold text-lg leading-none tracking-tight text-left">BIO BOT</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-white text-[#162A5A] flex items-center justify-center font-black text-xl shadow-inner">B</div>
        </div>

        <button
          onClick={startChat}
          className="text-xs bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all border border-white/20 font-sans flex items-center gap-2"
        >
          <span>איפוס שיחה</span>
          <span className="text-sm">↺</span>
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC] space-y-6 dark:bg-slate-900"
        >
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] px-6 py-4 rounded-2xl shadow-sm leading-relaxed ${
                  m.sender === "user"
                    ? "bg-[#3B82F6] text-white rounded-tl-none shadow-blue-100 font-sans dark:bg-blue-500"
                    : "bg-white border border-gray-200 text-gray-800 rounded-tr-none shadow-gray-100 font-sans dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 " +
                      // ✅ NEW: make injected bot HTML readable in dark mode
                      "dark:**:text-slate-100 " +
                      "dark:[&_.text-gray-700]:text-slate-200 dark:[&_.text-gray-600]:text-slate-300 dark:[&_.text-gray-500]:text-slate-400 dark:[&_.text-gray-400]:text-slate-500"
                }`}
                dangerouslySetInnerHTML={{ __html: m.html }}
              />
            </div>
          ))}

          {/* Quick Actions (Pills) - Aligned to Bot side (Right in RTL) */}
          <div className="pt-4 flex flex-col gap-4 items-end">
            {!context.yearbook && (
              <div className="flex flex-wrap gap-2 justify-end">
                {yearbooks.map((y) => (
                  <button key={y.id} className={pillBtn} onClick={() => chooseYearbook(y)}>{y.label}</button>
                ))}
              </div>
            )}

            {context.yearbook && !context.topic && (
              <div className="flex flex-col items-end gap-3 w-full">
                <div className="flex items-center gap-2 mb-1 text-[#162A5A] font-bold text-lg px-1 animate-in fade-in slide-in-from-right-2 duration-300 dark:text-blue-200">
                  <span>  אפשר לבחור נושא כמו 👇</span>
                </div>

                <div className="flex flex-wrap gap-3 justify-end">
                  <button className={pillBtn} onClick={() => chooseTopic("courses")}>
                    📚 קורסי חובה
                  </button>
                  <button className={pillBtn} onClick={() => chooseTopic("advisor")}>
                    👨‍🏫 יועץ אקדמי
                  </button>
                  <button className={pillBtn} onClick={() => chooseTopic("exceptional")}>
                    📝 רישום חריג
                  </button>
                </div>
              </div>
            )}

            {context.topic && !context.semesterNum && (context.topic === "courses" || context.topic === "advisor") && (
              <div className="flex flex-wrap gap-2 justify-end">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button key={n} className={pillBtn} onClick={() => chooseSemester(n)}>סמסטר {n}</button>
                ))}
              </div>
            )}

            {context.topic === "advisor_input" && (
              <div className="grid grid-cols-7 gap-2 max-w-md bg-white p-5 rounded-2xl shadow-lg border border-gray-100 animate-in fade-in zoom-in duration-200 dark:bg-slate-950 dark:border-slate-800">
                {HEB_LETTERS.map((L) => (
                  <button key={L} className={letterBtn} onClick={() => chooseLetter(L)}>{L}</button>
                ))}
              </div>
            )}

            {context.topic === "track_input" && (
              <div className="flex flex-wrap gap-3 justify-end">
                {TRACKS.map((t) => (
                  <button key={t} className={pillBtn} onClick={() => { addUser(t); loadAdvisor(context.lastNameLetter, context.semesterNum, t); }}>{t}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation & Input */}
      <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] dark:bg-slate-950 dark:border-slate-800">
        <div className="flex flex-col gap-3">
          {context.topic && (
            <div className="flex gap-4 px-2">
              <button
                className="text-[11px] font-bold text-blue-600 hover:underline uppercase tracking-wider font-sans dark:text-blue-300"
                onClick={() => setContext(p => ({ ...p, topic: null, semesterNum: null }))}
              >
                ← החלפת נושא
              </button>
              <button
                className="text-[11px] font-bold text-gray-400 hover:underline uppercase tracking-wider font-sans dark:text-slate-400"
                onClick={() => setContext(p => ({ ...p, semesterNum: null }))}
              >
                ← שינוי סמסטר
              </button>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              {/* רשימת הצעות שצפה מעל ה-input */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute bottom-full mb-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden dark:bg-slate-950 dark:border-slate-700">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      className="w-full text-right px-4 py-3 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-none flex justify-between items-center transition-colors dark:hover:bg-slate-800 dark:border-slate-900"
                     onMouseDown={(e) => {
                      e.preventDefault(); 
                      setInput(prev => {
                        const parts = prev.trim().split(/\s+/);
                        parts.pop();
                        return [...parts, s.courseName].join(" ");
                      });
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    >
                      <span className="font-medium text-gray-700 dark:text-slate-100">{s.courseName}</span>
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded dark:text-slate-300 dark:bg-slate-800">{s.courseCode}</span>
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  fetchSuggestions(val);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // השהייה קלה כדי לאפשר לחיצה
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={context.yearbook ? "שאל על קורס (למשל: דרישות קדם לביוכימיה)..." : "אנא בחר שנתון קודם..."}
                className="
                  w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm
                  focus:ring-2 focus:ring-[#162A5A] focus:bg-white transition-all outline-none pr-14 shadow-inner font-sans
                  dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100
                  dark:focus:ring-blue-500 dark:focus:bg-slate-900
                  placeholder:text-slate-400 dark:placeholder:text-slate-500
                "
              />
              <button
                onClick={sendMessage}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#162A5A] text-white p-2.5 rounded-xl hover:bg-blue-900 transition-all shadow-lg active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
