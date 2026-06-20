import { useEffect, useRef, useState } from "react";
import FeedbackModal from "./FeedbackModal.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const TRACKS = ["מולקולרית-תרופתית", "מזון והסביבה"];
const HEB_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];

const SECRETARY_PHONE = "04-9901927";
const SECRETARY_EMAIL = "nataliav@braude.ac.il";
const EXCEPTION_FORM_URL = `${API_BASE}/files/טופס_רישום_או_ביטול_קורס.doc`;
const ADVISOR_FORM_URL = `${API_BASE}/files/טופס_ייעוץ_לסטודנט.docx`;

export default function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState({
    yearbook: null,
    semesterNum: null,
    semesterKey: null,
    topic: null,
    lastNameLetter: null,
    track: null,
  });

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasExchange, setHasExchange] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimerRef = useRef(null);

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
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    startChat();
    loadYearbooks();
  }, []);

  const addBot = (html, variant = "bubble") => setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "bot", html, variant }]);
  const addUser = (text) => setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "user", html: text }]);

  const startChat = () => {
    setMessages([]);
    setHasExchange(false);
    setRecentQuestions([]);
    setContext({ yearbook: null, semesterNum: null, semesterKey: null, topic: null, lastNameLetter: null, track: null });
    addBot(`
  <div class="space-y-2">
    <div class="text-xl font-bold text-brand-navy">ברוכים הבאים ל-BIO BOT</div>
    <p class="text-gray-700">אני כאן כדי לעזור לך עם מידע אקדמי, קורסים וייעוץ במחלקה.</p>
    <div class="text-sm font-semibold text-bio-green mt-2 font-sans">
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
      addBot("<div class='text-red-500 font-sans'>תקלה בחיבור לשרת הנתונים.</div>");
    }
  };

  const sendMessage = async () => {
    const q = input.trim();
    if (!q) return;

    setSuggestions([]);
    setShowSuggestions(false);

    if (!context.yearbook) {
      addBot(`<div class="text-amber-600 font-medium italic font-sans">יש לבחור שנתון מהרשימה לפני שניתן לשאול שאלות.</div>`);
      return;
    }
    addUser(q);
    setRecentQuestions((prev) => [...prev, q].slice(-5));
    setInput("");
    setIsBotResponding(true);
    const loadingId = crypto.randomUUID();
    setMessages((p) => [...p, { id: loadingId, sender: "bot", html: "רגע אני חושב..." }]);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearbookId: context.yearbook,
          question: q,
          semester: context.semesterNum ? String(context.semesterNum) : null,
          topic: (context.topic === "advisor_input" || context.topic === "track_input")
            ? "advisor"
            : (context.topic ?? null),
        }),
      });
      const data = await res.json();
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      addBot(data.html || "לא נמצאה תשובה בבסיס הנתונים.");
      setHasExchange(true);
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      addBot("<div class='font-sans'>שגיאת שרת.</div>");
    } finally {
      setIsBotResponding(false);
    }
  };

  const chooseYearbook = (y) => {
    addUser(y.label);
    setContext((p) => ({ ...p, yearbook: y.id }));
  };

  const chooseTopic = (t) => {
    const labels = { courses: "קורסי חובה", advisor: "יועץ אקדמי", exceptional: "רישום חריג" };
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
    addBot("<div class='font-sans'>שולף נתונים מהשנתון...</div>");
    try {
      const res = await fetch(`${API_BASE}/api/requiredcourses/${yb}/semester_${sem}`);
      const data = await res.json();
      if (!res.ok || !data.courses?.length) return addBot("<div class='font-sans'>לא נמצאו קורסים.</div>");

      const rows = data.courses.map((c) => {
        const credits = c.credits ? `${c.credits} נ"ז` : 'ללא נ"ז';
        return `
        <div class="rounded-xl border border-surface-border bg-surface-page px-3 py-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-content-primary leading-snug">
              <span class="font-bold">${c.courseName}</span>
              <span class="text-content-muted">(${credits})</span>
            </span>
            <span class="text-xs text-content-muted shrink-0">סימול: <span class="font-mono">${c.courseCode}</span></span>
          </div>
          ${c.relations?.length ? `
            <div class="mt-1 text-xs">
              ${c.relations.map((r) => `
                <span class="inline-block ms-2 font-semibold ${r.type === "PREREQUISITE" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}">
                  · ${r.type === "PREREQUISITE" ? "קדם" : "צמוד"}: ${r.courseName}
                </span>
              `).join("")}
            </div>
          ` : ""}
        </div>
        `;
      }).join("");

      const html = `
        <div class="w-full rounded-2xl border border-surface-border bg-surface-card shadow-lg overflow-hidden font-sans" dir="rtl">
          <div class="bg-brand-navy text-white px-4 py-2.5 flex items-center justify-between">
            <span class="font-bold text-base">קורסי חובה - סמסטר ${sem}</span>
            <span class="text-xs opacity-80">${data.courses.length} קורסים</span>
          </div>
          <div class="p-3 space-y-2">
            ${rows}
          </div>
        </div>
      `;

      addBot(html, "panel");
      setHasExchange(true);
    } catch (e) { addBot("<div class='font-sans'>שגיאה.</div>"); }
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
    setContext(p => ({ ...p, topic: "advisor" }));
    try {
      const params = new URLSearchParams({ lastNameLetter: letter, semester: String(sem) });
      if (track) params.set("track", track);

      const res = await fetch(`${API_BASE}/api/advisor?${params}`);
      const data = await res.json();
      const a = data.advisors?.[0];

      if (a) {
        addBot(`
  <div class="p-3 rounded-2xl border space-y-1.5 font-sans bg-blue-50 border-blue-100 text-gray-800">
    <div class="font-bold text-brand-navy">היועץ האקדמי שלך:</div>
    <div class="text-sm text-gray-800"><b>שם:</b> ${a.name}</div>
    <div class="text-sm text-gray-800">
      <b>מייל:</b>
      <a href="mailto:${a.email}" class="text-bio-green underline">${a.email}</a>
    </div>
    <div class="mt-1.5 text-xs p-2 rounded border bg-white border-blue-50 text-gray-700">
      זכור למלא
      <a href="${ADVISOR_FORM_URL}" class="underline font-bold text-bio-green">טופס ייעוץ</a>
      לפני הפנייה.
    </div>
  </div>
`);
        setHasExchange(true);
      } else {
        addBot("<div class='font-sans text-red-500'>לא נמצא יועץ מתאים לאות זו.</div>");
      }
    } catch (e) {
      addBot("<div class='font-sans'>שגיאה בחיבור לשרת.</div>");
    }
  };

  const showExceptionalRegistration = () => {
    addBot(`
<div class="rounded-2xl p-4 shadow-sm space-y-3 bg-white border border-blue-100 text-gray-800">
  <div class="text-lg font-bold text-bio-green">רישום או ביטול חריג לקורסים</div>

  <div class="text-sm text-gray-800">
    משתמשים ברישום חריג כאשר <strong>לא ניתן להירשם לקורס דרך תחנת מידע</strong>.
  </div>

  <div class="rounded-xl p-2.5 text-sm space-y-1 bg-blue-50 border border-blue-200">
    <div class="font-semibold mb-1">מתי זה קורה בדרך כלל?</div>
    <div>אין מקום פנוי בקורס</div>
    <div>נכשלת בקורס פעמיים</div>
    <div>מועד הרישום/הביטול הסתיים</div>
  </div>

  <div class="text-sm font-semibold">תהליך הגשת בקשה לרישום חריג:</div>

  <div class="text-sm space-y-2" dir="rtl">
    <div class="flex items-start gap-3">
      <span class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-brand-navy text-white text-sm font-bold">1</span>
      <span>מורידים את הטופס.</span>
    </div>
    <div class="flex items-start gap-3">
      <span class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-brand-navy text-white text-sm font-bold">2</span>
      <span>ממלאים פרטי הקורס והסיבה לבקשה.</span>
    </div>
    <div class="flex items-start gap-3">
      <span class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-brand-navy text-white text-sm font-bold">3</span>
      <span>שולחים מייל מנומס ליועץ ומסבירים את הבקשה שלכם כולל צירוף הטופס.</span>
    </div>
    <div class="flex items-start gap-3">
      <span class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-brand-navy text-white text-sm font-bold">4</span>
      <span>היועץ מאשר/דוחה את הבקשה וממשיך את הטיפול.</span>
    </div>
  </div>

  <div class="border-t border-gray-200 pt-2.5 text-sm space-y-1.5">
    <div>
      <strong>טופס רישום/ביטול קורס:</strong><br/>
      <a href="${EXCEPTION_FORM_URL}" class="underline text-bio-green" target="_blank" rel="noreferrer">להורדת הטופס</a>
    </div>
    <div class="text-gray-700">
      <strong>מזכירות:</strong> ${SECRETARY_PHONE}<br/>
      <strong>מייל:</strong>
      <a class="underline text-bio-green" href="mailto:${SECRETARY_EMAIL}">${SECRETARY_EMAIL}</a>
    </div>
  </div>
</div>
`);
  };

  const pillBtn =
    "px-4 py-2 rounded-full border border-bio-green bg-surface-card text-bio-green text-body font-medium " +
    "hover:bg-surface-raised transition-colors shadow-sm active:scale-95 font-sans " +
    "dark:border-bio-green-glow dark:text-bio-green-glow dark:hover:bg-surface-raised";

  const letterBtn =
    "w-9 h-9 flex items-center justify-center rounded-lg border border-surface-border bg-surface-card text-content-primary " +
    "hover:border-brand-navy hover:text-brand-navy transition-all text-body font-bold font-sans shadow-sm " +
    "dark:hover:border-bio-green-glow dark:hover:text-bio-green-glow";

  return (
    <div
      className="w-full max-w-6xl mx-auto h-full bg-surface-card text-content-primary rounded-xl shadow-2xl border border-surface-border flex flex-col overflow-hidden font-sans"
      dir="rtl"
    >
      {/* Header */}
      <div className="bg-brand-navy text-white px-8 py-5 flex flex-row-reverse items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-heading leading-none text-left">BIO BOT</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-white text-brand-navy flex items-center justify-center font-black text-xl shadow-inner">B</div>
        </div>

        <div className="flex items-center gap-2">
          {context.topic && (
            <>
              <button
                onClick={() => setContext(p => ({ ...p, topic: null, semesterNum: null }))}
                className="text-caption bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all border border-white/20 font-sans"
              >
                החלפת נושא
              </button>
              <button
                onClick={() => setContext(p => ({ ...p, semesterNum: null }))}
                className="text-caption bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all border border-white/20 font-sans"
              >
                שינוי סמסטר
              </button>
            </>
          )}
          {hasExchange && (
            <button
              onClick={() => setShowFeedback(true)}
              className="text-caption bg-brand-gold text-brand-navy font-bold px-4 py-2 rounded-lg hover:bg-brand-gold-hover transition-all border border-yellow-300 shadow-sm active:scale-95 font-sans flex items-center gap-2"
            >
              <span>סיים שיחה</span>
              <span>✓</span>
            </button>
          )}
          <button
            onClick={startChat}
            className="text-caption bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all border border-white/20 font-sans flex items-center gap-2"
          >
            <span>איפוס שיחה</span>
            <span className="text-body">↺</span>
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={chatRef}
          dir="ltr"
          className="chat-scroll flex-1 overflow-y-auto p-5 bg-surface-page"
        >
          <div dir="rtl" className="space-y-4">
          {messages.map((m) => {
            const isPanel = m.sender === "bot" && m.variant === "panel";
            return (
              <div
                key={m.id}
                className={`flex ${
                  m.sender === "user" ? "justify-start" : isPanel ? "justify-center" : "justify-end"
                }`}
              >
                <div
                  className={
                    isPanel
                      ? "bot-bubble w-full max-w-2xl"
                      : `max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm leading-relaxed text-body ${
                          m.sender === "user"
                            ? "bg-brand-navy text-white rounded-tl-none font-sans"
                            : "bot-bubble bg-surface-card border border-surface-border text-content-primary rounded-tr-none font-sans"
                        }`
                  }
                  dangerouslySetInnerHTML={{ __html: m.html }}
                />
              </div>
            );
          })}

          {/* Quick action pills */}
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
                <div className="flex items-center gap-2 mb-1 text-brand-navy dark:text-bio-green-glow text-heading px-1 animate-in fade-in slide-in-from-right-2 duration-300">
                  <span>אפשר לבחור נושא כמו</span>
                </div>
                <div className="flex flex-wrap gap-3 justify-end">
                  <button className={pillBtn} onClick={() => chooseTopic("courses")}>קורסי חובה</button>
                  <button className={pillBtn} onClick={() => chooseTopic("advisor")}>יועץ אקדמי</button>
                  <button className={pillBtn} onClick={() => chooseTopic("exceptional")}>רישום חריג</button>
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
              <div className="grid grid-cols-7 gap-2 max-w-md bg-surface-card p-5 rounded-2xl shadow-lg border border-surface-border animate-in fade-in zoom-in duration-200">
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
      </div>

      {/* Footer input */}
      <div className="p-6 bg-surface-card border-t border-surface-border shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute bottom-full mb-2 w-full bg-surface-card border border-surface-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      className="w-full text-right px-4 py-3 text-body hover:bg-surface-raised border-b border-surface-border last:border-none flex justify-between items-center transition-colors"
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
                      <span className="font-medium text-content-primary">{s.courseName}</span>
                      <span className="text-caption font-mono text-content-muted bg-surface-raised px-1.5 py-0.5 rounded">{s.courseCode}</span>
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`star-border relative rounded-2xl border border-surface-border p-0.5 ${isBotResponding ? "star-border--responding" : ""}`}
              >
                <span className="star-border__points star-border__points--bottom" aria-hidden="true" />
                <span className="star-border__points star-border__points--top" aria-hidden="true" />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInput(val);
                    clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = setTimeout(() => fetchSuggestions(val), 300);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={context.yearbook ? "שאל על קורס (למשל: דרישות קדם לביוכימיה)..." : "אנא בחר שנתון קודם..."}
                  className="w-full bg-surface-page rounded-2xl px-6 py-4 text-body text-content-primary focus:bg-surface-card transition-colors outline-none pr-14 shadow-inner font-sans placeholder:text-content-muted relative z-10"
                />
                <button
                  onClick={sendMessage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-brand-navy dark:bg-bio-teal text-white p-2.5 rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95 z-20"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmit={() => { setShowFeedback(false); startChat(); }}
        questions={recentQuestions}
        yearbook={context.yearbook}
      />
    </div>
  );
}
