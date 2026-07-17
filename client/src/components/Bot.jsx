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

// Animated three-dot "thinking" indicator used for transient loading bubbles.
const thinkingHtml = (label = "") =>
  `<span class="inline-flex items-center gap-2">` +
  `<span class="bot-typing" aria-hidden="true"><i></i><i></i><i></i></span>` +
  (label ? `<span class="text-content-muted">${label}</span>` : "") +
  `</span>`;

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
  const [showFeedback, setShowFeedback] = useState(false);
  // "positive" | "negative" - which thumb opened the feedback popup.
  const [feedbackRating, setFeedbackRating] = useState(null);
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


  // Bot messages can carry a `variant` ("panel") and an attached `controls` key.
  // The controls (selection pills) render INSIDE the bubble via MessageBubble, so
  // the bot's prompt and its choices read as a single message - like ChatGPT/Claude.
  const addBot = (html, opts = {}) =>
    setMessages((p) => [...p, { id: crypto.randomUUID(), sender: "bot", html, variant: opts.variant || null, controls: opts.controls || null }]);
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
    setContext({ yearbook: null, semesterNum: null, semesterKey: null, topic: null, lastNameLetter: null, track: null });
    addBot(greetingHtml(), { controls: "yearbook" });
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
    setMessages((p) => [...p, { id: loadingId, sender: "bot", html: thinkingHtml() }]);

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
    addBot('<b class="font-sans">מצוין! במה אפשר לעזור? אפשר לבחור נושא:</b>', { controls: "topic" });
  };

  // Re-open topic selection from the header, as a fresh bot message.
  const promptTopic = () => {
    setContext((p) => ({ ...p, topic: null, semesterNum: null, selectedMitve: null, selectedGroup: null }));
    addBot('<b class="font-sans">אפשר לבחור נושא:</b>', { controls: "topic" });
  };

  // Re-open the semester picker from the header, as a fresh bot message.
  const promptSemester = () => {
    setContext((p) => ({ ...p, semesterNum: null }));
    addBot('<b class="font-sans">בחר/י סמסטר:</b>', { controls: "semester" });
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
    const labels = { courses: "קורסי חובה", advisor: "יועץ אקדמי", exceptional: "רישום חריג", reserves: "מילואים", files: "טפסים" };
    addUser(labels[t]);
    // Leaving the reserves flow: drop the selected mitve/group so later questions
    // aren't answered from the reserve-duty document.
    if (t !== "reserves") setContext((p) => ({ ...p, selectedMitve: null, selectedGroup: null }));
    if (t === "exceptional") {
      showExceptionalRegistration();
    }
    else if (t === "reserves") {
      setContext((p) => ({ ...p, topic: "reserves", semesterNum: null }));
      showReservesGuidelines();
    }
    else if (t === "files") {
      loadFiles();
    } else {
      // Reset semester so the picker re-shows, even if one was chosen earlier this session.
      setContext((p) => ({ ...p, topic: t, semesterNum: null }));
      addBot("<b class='font-sans'>בחר/י סמסטר:</b>", { controls: "semester" });
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
      if (list.length) addBot(filesPromptHtml(), { controls: "files" });
      else addBot(noFileMatchHtml([]));
    } catch {
      addBot("<div class='font-sans'>שגיאה בטעינת הקבצים.</div>");
    }
  };

  const chooseFile = (f) => {
    addUser(fileDisplayName(f));
    setFilesExpanded(false);
    addBot(fileMatchesHtml([f]), { controls: "files" });
    setHasExchange(true);
    setAskedTyped(true);
  };

  const handleFileQuery = async (q) => {
    setIsBotResponding(true);
    const loadingId = crypto.randomUUID();
    setMessages((p) => [...p, { id: loadingId, sender: "bot", html: thinkingHtml("מחפש קובץ מתאים") }]);
    try {
      const res = await fetch(`${API_BASE}/api/forms/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setMessages((p) => p.filter((m) => m.id !== loadingId));
      const matches = data.matches || [];
      setFilesExpanded(false);
      addBot(matches.length ? fileMatchesHtml(matches) : noFileMatchHtml(data.all || files), { controls: "files" });
      setHasExchange(true);
      setAskedTyped(true);
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
      addBot("<b class='font-sans'>מה האות הראשונה של שם המשפחה?</b>", { controls: "letters" });
      setContext((p) => ({ ...p, topic: "advisor_input", semesterNum: n }));
    }
  };

  const loadRequiredCourses = async (yb, sem) => {
    addBot(thinkingHtml("שולף נתונים מהשנתון"));
    try {
      const res = await fetch(`${API_BASE}/api/requiredcourses/${yb}/semester_${sem}`);
      const data = await res.json();
      if (!res.ok || !data.courses?.length) return addBot("<div class='font-sans'>לא נמצאו קורסים.</div>");

      addBot(requiredCoursesHtml(data.courses, sem), { variant: "panel" });
      setHasExchange(true);
    } catch (e) { addBot("<div class='font-sans'>שגיאה.</div>"); }
  };

  const chooseLetter = (L) => {
    addUser(L);
    if (context.semesterNum >= 5) {
      setContext(p => ({ ...p, lastNameLetter: L, topic: "track_input" }));
      addBot("<b class='font-sans'>בחר התמחות:</b>", { controls: "tracks" });
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
    "px-4 py-2 rounded-full border border-bio-green/70 bg-surface-card text-bio-green text-body font-medium shadow-sm " +
    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-bio-green hover:bg-bio-green/5 active:translate-y-0 active:scale-95 font-sans " +
    "dark:border-bio-green-glow/60 dark:text-bio-green-glow dark:hover:bg-bio-green-glow/10 dark:hover:border-bio-green-glow";

  // Condensed variant for the file browser - smaller so many files stay readable.
  const filePillBtn =
    "px-2.5 py-1 rounded-full border border-bio-green/50 bg-surface-card text-bio-green text-caption font-medium " +
    "transition-all duration-200 hover:-translate-y-0.5 hover:bg-bio-green/5 hover:border-bio-green active:translate-y-0 active:scale-95 font-sans " +
    "dark:border-bio-green-glow/50 dark:text-bio-green-glow dark:hover:bg-bio-green-glow/10";

  const letterBtn =
    "w-full max-w-9 h-9 justify-self-center flex items-center justify-center rounded-lg border border-surface-border bg-surface-card text-content-primary shadow-sm " +
    "transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-navy hover:text-brand-navy hover:bg-surface-raised text-body font-bold font-sans " +
    "dark:hover:border-bio-green-glow dark:hover:text-bio-green-glow";

  // Selection controls attached to a bot message; rendered INSIDE that bubble so
  // the prompt and its choices form one unit. dir=rtl on the bubble makes
  // flex-wrap flow from the right, so no explicit justify-end is needed.
  const renderControls = (type) => {
    switch (type) {
      case "yearbook":
        if (loadingYearbooks)
          return (
            <div className="flex items-center gap-2 text-bio-green dark:text-bio-green-glow text-body">
              <span className="h-4 w-4 rounded-full border-2 border-bio-green/30 border-t-bio-green dark:border-bio-green-glow/30 dark:border-t-bio-green-glow animate-spin" />
              <span>טוען שנתונים...</span>
            </div>
          );
        if (yearbooksError)
          return (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-red-500 text-body">תקלה בחיבור לשרת הנתונים.</span>
              <button className={pillBtn} onClick={loadYearbooks}>נסה שוב</button>
            </div>
          );
        return (
          <div className="flex flex-wrap gap-2">
            {yearbooks.map((y) => (
              <button key={y.id} className={pillBtn} onClick={() => chooseYearbook(y)}>{y.label}</button>
            ))}
          </div>
        );

      case "topic":
        return (
          <div className="flex flex-wrap gap-2.5">
            <button className={pillBtn} onClick={() => chooseTopic("courses")}>קורסי חובה</button>
            <button className={pillBtn} onClick={() => chooseTopic("advisor")}>יועץ אקדמי</button>
            <button className={pillBtn} onClick={() => chooseTopic("exceptional")}>רישום חריג</button>
            <button className={pillBtn} onClick={() => chooseTopic("reserves")}>מילואים</button>
            <button className={pillBtn} onClick={() => chooseTopic("files")}>טפסים</button>
          </div>
        );

      case "semester":
        return (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} className={pillBtn} onClick={() => chooseSemester(n)}>סמסטר {n}</button>
            ))}
          </div>
        );

      case "letters":
        return (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 max-w-md">
            {HEB_LETTERS.map((L) => (
              <button key={L} className={letterBtn} onClick={() => chooseLetter(L)}>{L}</button>
            ))}
          </div>
        );

      case "tracks":
        return (
          <div className="flex flex-wrap gap-2.5">
            {TRACKS.map((t) => (
              <button key={t} className={pillBtn} onClick={() => { addUser(t); loadAdvisor(context.lastNameLetter, context.semesterNum, t); }}>{t}</button>
            ))}
          </div>
        );

      case "files":
        if (!files.length) return null;
        return filesExpanded ? (
          <div className="flex flex-col gap-2 w-full">
            {groupByCategory(files).map((group) => (
              <div key={group.value} className="flex flex-col gap-1 w-full">
                <span className="text-[11px] font-bold text-brand-navy/70 dark:text-bio-green-glow/70">{group.label}</span>
                <div className="flex flex-wrap gap-1.5">
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
          <button className={pillBtn} onClick={() => setFilesExpanded(true)}>בחירת קובץ נוסף</button>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="w-full max-w-6xl mx-auto h-full bg-surface-card text-content-primary rounded-2xl shadow-2xl border border-surface-border ring-1 ring-black/5 flex flex-col overflow-hidden font-sans"
      dir="rtl"
    >
      {/* Header */}
      <div className="relative bg-gradient-to-l from-brand-navy to-brand-navy-deep text-white px-4 sm:px-6 py-3 flex flex-row-reverse items-center justify-between shadow-md z-10">
        <div className="flex flex-row-reverse items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-white text-brand-navy flex items-center justify-center font-black text-xl shadow-inner ring-2 ring-white/10">B</div>
            <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-bio-green-glow ring-2 ring-brand-navy" />
          </div>
          <div className="leading-tight text-right">
            <h1 className="text-heading leading-none">BIO BOT</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Re-opens topic selection as a fresh bot message */}
          {context.yearbook && context.topic && (
            <button
              onClick={promptTopic}
              className="text-caption bg-white/10 px-3 sm:px-4 py-2 rounded-lg hover:bg-white/20 hover:border-white/30 transition-all border border-white/15 font-sans"
            >
              בחירת נושא
            </button>
          )}
          {context.semesterNum && ["courses", "advisor", "advisor_input", "track_input"].includes(context.topic) && (
            <button
              onClick={promptSemester}
              className="text-caption bg-white/10 px-3 sm:px-4 py-2 rounded-lg hover:bg-white/20 hover:border-white/30 transition-all border border-white/15 font-sans"
            >
              שינוי סמסטר
            </button>
          )}
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px brand-hairline" />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={chatRef}
          dir="ltr"
          className="chat-scroll flex-1 overflow-y-auto p-3 sm:p-5 bg-surface-page"
        >
          <div dir="rtl" className="space-y-4">
          {messages.map((m, idx) => {
            const isLast = idx === messages.length - 1;
            return (
              <MessageBubble
                key={m.id}
                m={m}
                showActions={m.sender === "bot" && isLast && hasExchange && !isBotResponding}
                controls={m.sender === "bot" && isLast && m.controls && !isBotResponding ? renderControls(m.controls) : null}
                askedTyped={askedTyped}
                onFeedback={(rating) => { setFeedbackRating(rating); setShowFeedback(true); }}
                onNewChat={startChat}
              />
            );
          })}
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
        initialRating={feedbackRating}
        onClose={() => setShowFeedback(false)}
        onSubmit={() => { setShowFeedback(false); startChat(); }}
        questions={recentQuestions}
        yearbook={context.yearbook}
      />

      {showPrivacy && <PrivacyNotice onAcknowledge={ackPrivacy} />}
    </div>
  );
}
