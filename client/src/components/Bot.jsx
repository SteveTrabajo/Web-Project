import { useEffect, useRef, useState } from "react";
import FeedbackModal from "./FeedbackModal.jsx";
import PrivacyNotice from "./PrivacyNotice.jsx";
import { MessageBubble, ChatInput } from "./BotParts.jsx";
import {
  greetingHtml,
  reservesMitvotPromptHtml,
  reservesDaysPromptHtml,
  reservesSavedHtml,
  requiredCoursesHtml,
  advisorsHtml,
  exceptionalRegistrationHtml,
  filesPromptHtml,
  fileMatchesHtml,
  noFileMatchHtml,
  fileDisplayName,
} from "./botTemplates.js";
import { groupByCategory } from "./formCategories.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const TRACKS = ["מולקולרית-תרופתית", "מזון והסביבה"];
const HEB_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];

const FALLBACK_EXCEPTION_FORM_URL = `${API_BASE}/files/טופס_רישום_או_ביטול_קורס.doc`;
const FALLBACK_ADVISOR_FORM_URL = `${API_BASE}/files/טופס_ייעוץ_לסטודנט.docx`;

export default function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [formUrls, setFormUrls] = useState({
    advisor: FALLBACK_ADVISOR_FORM_URL,
    exception_registration: FALLBACK_EXCEPTION_FORM_URL,
  });
  const [context, setContext] = useState({
    yearbook: null,
    semesterNum: null,
    semesterKey: null,
    topic: null,
    lastNameLetter: null,
    track: null,
  });

  // One-time (per browser) privacy notice on first chat open.
  const [showPrivacy, setShowPrivacy] = useState(() => !localStorage.getItem("bio_privacy_ack"));
  const ackPrivacy = () => {
    localStorage.setItem("bio_privacy_ack", "1");
    setShowPrivacy(false);
  };

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Student files (from the admin "טפסים" store) shown as pills in the קבצים flow.
  const [files, setFiles] = useState([]);
  // Collapse the file grid to a single "choose another" pill after a pick, so the
  // bot's answer isn't buried under the full list.
  const [filesExpanded, setFilesExpanded] = useState(true);
  // Topic pills show at chat start, hide once a topic is picked or a typed
  // question gets answered, and return via the header button or a new chat.
  const [showTopicPills, setShowTopicPills] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasExchange, setHasExchange] = useState(false);
  const [askedTyped, setAskedTyped] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimerRef = useRef(null);

  const fetchSuggestions = async (val) => {
    // No course autocomplete in the files flow - the input is a file request there.
    if (val.length < 2 || !context.yearbook || context.topic === "files") {
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
  const [loadingYearbooks, setLoadingYearbooks] = useState(true);
  const [yearbooksError, setYearbooksError] = useState(false);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    startChat();
    loadYearbooks();
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/forms`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const forms = data?.forms;
        if (!Array.isArray(forms) || !forms.length) return;
        setFormUrls((prev) => {
          const next = { ...prev };
          for (const f of forms) {
            if (f.usage === "advisor" && f.url) next.advisor = f.url;
            if (f.usage === "exception_registration" && f.url) next.exception_registration = f.url;
          }
          return next;
        });
      })
      .catch(() => {});
  }, []);


  const addBot = (html) => setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "bot", html }]);
  const addUser = (text) => setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "user", html: text }]);

  // Compact plain-text form of a bubble, used to send conversation context to the server.
  const stripHtml = (html) =>
    String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);

  const startChat = () => {
    setMessages([]);
    setHasExchange(false);
    setAskedTyped(false);
    setRecentQuestions([]);
    setShowTopicPills(true);
    setContext({ yearbook: null, semesterNum: null, semesterKey: null, topic: null, lastNameLetter: null, track: null });
    addBot(greetingHtml());
  };

  const loadYearbooks = async () => {
    setLoadingYearbooks(true);
    setYearbooksError(false);
    try {
      const res = await fetch(`${API_BASE}/api/yearbooks`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.yearbooks)) setYearbooks(data.yearbooks);
      else setYearbooksError(true);
    } catch (e) {
      setYearbooksError(true);
    } finally {
      setLoadingYearbooks(false);
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

    // In the files flow a typed message is a natural-language file request.
    if (context.topic === "files") {
      handleFileQuery(q);
      return;
    }

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
          reservesMitve: context.selectedMitve || null,
          reservesGroup: context.selectedGroup || null,
          // Latest turns of THIS conversation (excludes the question just typed,
          // since addUser's state update hasn't applied yet) for follow-up context.
          history: messages
            .slice(-7)
            .map((m) => ({ role: m.sender, text: stripHtml(m.html) }))
            .filter((m) => m.text),
        }),
      });
      const data = await res.json();
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      addBot(data.html || "לא נמצאה תשובה בבסיס הנתונים.");
      setHasExchange(true);
      setAskedTyped(true);
      setShowTopicPills(false);
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

  window.handleReservesMitve = (mitveKey, mitveLabel) => handleReservesMitve(mitveKey, mitveLabel);
  window.handleReservesDays = (daysKey, daysLabel) => handleReservesDays(daysKey, daysLabel);
  // Lets the server's advisor-redirect button launch the interactive advisor picker.
  window.startAdvisorFlow = () => chooseTopic("advisor");

const showReservesGuidelines = () => {
    addBot(reservesMitvotPromptHtml());
  };

  const handleReservesMitve = (mitveKey, mitveLabel) => {
  
    window.handleReservesDays = handleReservesDays;

    addUser(mitveLabel);
    setContext((prev) => ({ ...prev, selectedMitve: mitveKey }));

    setTimeout(() => {
      addBot(reservesDaysPromptHtml(mitveKey));
    }, 600);
  };

  const handleReservesDays = (daysKey, daysLabel) => {
    window.handleReservesDays = handleReservesDays;

    addUser(daysLabel);
    
    setContext((prev) => ({ ...prev, selectedGroup: daysKey }));
    setTimeout(() => {
      addBot(reservesSavedHtml());
    }, 600);
  };

  const chooseTopic = (t) => {
    const labels = { courses: "קורסי חובה", advisor: "יועץ אקדמי", exceptional: "רישום חריג", reserves: "מילואים", files: "קבצים" };
    addUser(labels[t]);
    setShowTopicPills(false);
    if (t === "exceptional") {
      showExceptionalRegistration();
    }
    else if (t === "reserves") {
      showReservesGuidelines();
    }
    else if (t === "files") {
      loadFiles();
    } else {
      // Reset semester so the picker re-shows, even if one was chosen earlier this session.
      setContext((p) => ({ ...p, topic: t, semesterNum: null }));
      addBot("<b class='font-sans'>בחר/י סמסטר:</b>");
    }
  };

  // Files flow: fetch the student-files list, show them as pills + an intro that
  // invites a natural-language request. No semester needed.
  const loadFiles = async () => {
    setContext((p) => ({ ...p, topic: "files", semesterNum: null }));
    setFilesExpanded(true);
    try {
      const res = await fetch(`${API_BASE}/api/forms`);
      const data = await res.json();
      const list = Array.isArray(data.forms) ? data.forms : [];
      setFiles(list);
      addBot(list.length ? filesPromptHtml() : noFileMatchHtml([]));
    } catch {
      addBot("<div class='font-sans'>שגיאה בטעינת הקבצים.</div>");
    }
  };

  const chooseFile = (f) => {
    addUser(fileDisplayName(f));
    addBot(fileMatchesHtml([f]));
    setHasExchange(true);
    setAskedTyped(true);
    setFilesExpanded(false);
  };

  const handleFileQuery = async (q) => {
    setIsBotResponding(true);
    const loadingId = crypto.randomUUID();
    setMessages((p) => [...p, { id: loadingId, sender: "bot", html: "מחפש קובץ מתאים..." }]);
    try {
      const res = await fetch(`${API_BASE}/api/forms/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      const matches = data.matches || [];
      addBot(matches.length ? fileMatchesHtml(matches) : noFileMatchHtml(data.all || files));
      setHasExchange(true);
      setAskedTyped(true);
      setFilesExpanded(false);
    } catch {
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      addBot("<div class='font-sans'>שגיאה בחיפוש הקובץ.</div>");
    } finally {
      setIsBotResponding(false);
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

      addBot(requiredCoursesHtml(data.courses, sem), "panel");
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
      const list = data.advisors || [];

      if (list.length) {
        addBot(advisorsHtml(list, formUrls.advisor));
        setHasExchange(true);
      } else {
        addBot("<div class='font-sans text-red-500'>לא נמצא יועץ מתאים לאות זו.</div>");
      }
    } catch (e) {
      addBot("<div class='font-sans'>שגיאה בחיבור לשרת.</div>");
    }
  };

  const showExceptionalRegistration = () => {
    addBot(exceptionalRegistrationHtml(formUrls.exception_registration));
  };

  const pillBtn =
    "px-4 py-2 rounded-full border border-bio-green bg-surface-card text-bio-green text-body font-medium " +
    "hover:bg-surface-raised transition-colors shadow-sm active:scale-95 font-sans " +
    "dark:border-bio-green-glow dark:text-bio-green-glow dark:hover:bg-surface-raised";

  // Condensed variant for the file browser - smaller so many files stay readable.
  const filePillBtn =
    "px-2.5 py-1 rounded-full border border-bio-green/60 bg-surface-card text-bio-green text-caption font-medium " +
    "hover:bg-surface-raised hover:border-bio-green transition-colors active:scale-95 font-sans " +
    "dark:border-bio-green-glow/60 dark:text-bio-green-glow dark:hover:bg-surface-raised";

  const letterBtn =
    "w-full max-w-9 h-9 justify-self-center flex items-center justify-center rounded-lg border border-surface-border bg-surface-card text-content-primary " +
    "hover:border-brand-navy hover:text-brand-navy transition-all text-body font-bold font-sans shadow-sm " +
    "dark:hover:border-bio-green-glow dark:hover:text-bio-green-glow";

  return (
    <div
      className="w-full max-w-6xl mx-auto h-full bg-surface-card text-content-primary rounded-xl shadow-2xl border border-surface-border flex flex-col overflow-hidden font-sans"
      dir="rtl"
    >
      {/* Header */}
      <div className="bg-brand-navy text-white px-4 sm:px-8 py-2.5 flex flex-row-reverse items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-heading leading-none text-left">BIO BOT</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-white text-brand-navy flex items-center justify-center font-black text-xl shadow-inner">B</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Brings the topic pills back on demand after they were dismissed */}
          {context.yearbook && (context.topic || !showTopicPills) && (
            <button
              onClick={() => { setContext(p => ({ ...p, topic: null, semesterNum: null })); setShowTopicPills(true); }}
              className="text-caption bg-white/10 px-3 sm:px-4 py-2 rounded-lg hover:bg-white/20 transition-all border border-white/20 font-sans"
            >
              בחירת נושא
            </button>
          )}
          {context.topic && context.topic !== "files" && (
            <button
              onClick={() => setContext(p => ({ ...p, semesterNum: null }))}
              className="text-caption bg-white/10 px-3 sm:px-4 py-2 rounded-lg hover:bg-white/20 transition-all border border-white/20 font-sans"
            >
              שינוי סמסטר
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={chatRef}
          dir="ltr"
          className="chat-scroll flex-1 overflow-y-auto p-3 sm:p-5 bg-surface-page"
        >
          <div dir="rtl" className="space-y-4">
          {messages.map((m, idx) => (
            <MessageBubble
              key={m.id}
              m={m}
              showActions={m.sender === "bot" && idx === messages.length - 1 && hasExchange && !isBotResponding}
              askedTyped={askedTyped}
              onFeedback={() => setShowFeedback(true)}
              onNewChat={startChat}
            />
          ))}

          {/* Quick action pills */}
          <div className="pt-4 flex flex-col gap-4 items-end">
            {!context.yearbook && (
              <div className="flex flex-wrap gap-2 justify-end items-center">
                {loadingYearbooks ? (
                  <div className="flex items-center gap-2 text-bio-green dark:text-bio-green-glow text-body font-sans">
                    <span className="h-4 w-4 rounded-full border-2 border-bio-green/30 border-t-bio-green dark:border-bio-green-glow/30 dark:border-t-bio-green-glow animate-spin" />
                    <span>טוען שנתונים...</span>
                  </div>
                ) : yearbooksError ? (
                  <div className="flex items-center gap-3 font-sans">
                    <span className="text-red-500 text-body">תקלה בחיבור לשרת הנתונים.</span>
                    <button className={pillBtn} onClick={loadYearbooks}>נסה שוב</button>
                  </div>
                ) : (
                  yearbooks.map((y) => (
                    <button key={y.id} className={pillBtn} onClick={() => chooseYearbook(y)}>{y.label}</button>
                  ))
                )}
              </div>
            )}

            {context.yearbook && !context.topic && showTopicPills && (
              <div className="flex flex-col items-end gap-3 w-full">
                <div className="flex items-center gap-2 mb-1 text-brand-navy dark:text-bio-green-glow text-heading px-1 animate-in fade-in slide-in-from-right-2 duration-300">
                  <span>אפשר לבחור נושא כמו</span>
                </div>
                <div className="flex flex-wrap gap-3 justify-end">
                  <button className={pillBtn} onClick={() => chooseTopic("courses")}>קורסי חובה</button>
                  <button className={pillBtn} onClick={() => chooseTopic("advisor")}>יועץ אקדמי</button>
                  <button className={pillBtn} onClick={() => chooseTopic("exceptional")}>רישום חריג</button>
                  <button className={pillBtn} onClick={() => chooseTopic("reserves")}>מילואים</button>
                  <button className={pillBtn} onClick={() => chooseTopic("files")}>קבצים</button>
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
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 max-w-md bg-surface-card p-3 sm:p-5 rounded-2xl shadow-lg border border-surface-border animate-in fade-in zoom-in duration-200">
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

            {context.topic === "files" && files.length > 0 && (
              filesExpanded ? (
                <div className="flex flex-col items-end gap-2 w-full">
                  {groupByCategory(files).map((group) => (
                    <div key={group.value} className="flex flex-col items-end gap-1 w-full">
                      <span className="text-[11px] font-bold text-brand-navy/70 dark:text-bio-green-glow/70 px-1">{group.label}</span>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {group.items.map((f) => (
                          <button key={f.filename} className={filePillBtn} onClick={() => chooseFile(f)}>
                            {fileDisplayName(f)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-end w-full">
                  <button className={pillBtn} onClick={() => setFilesExpanded(true)}>בחירת קובץ נוסף</button>
                </div>
              )
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Footer input */}
      <ChatInput
        input={input}
        setInput={setInput}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        setSuggestions={setSuggestions}
        setShowSuggestions={setShowSuggestions}
        onSend={sendMessage}
        fetchSuggestions={fetchSuggestions}
        typingTimerRef={typingTimerRef}
        isBotResponding={isBotResponding}
        hasYearbook={!!context.yearbook}
      />

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmit={() => { setShowFeedback(false); startChat(); }}
        questions={recentQuestions}
        yearbook={context.yearbook}
      />

      {showPrivacy && <PrivacyNotice onAcknowledge={ackPrivacy} />}
    </div>
  );
}
