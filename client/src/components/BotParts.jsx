import { RotateCcw, Check } from "lucide-react";

// One chat bubble + (on the latest bot answer) the new-chat / feedback action icons.
export function MessageBubble({ m, showActions, askedTyped, onFeedback, onNewChat }) {
  const isPanel = m.sender === "bot" && m.variant === "panel";
  const colAlign = m.sender === "user" ? "items-start" : isPanel ? "items-center" : "items-end";
  return (
    <div className={`flex flex-col ${colAlign}`}>
      <div
        className={
          isPanel
            ? "bot-bubble w-full max-w-2xl break-words"
            : `max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm leading-relaxed text-body break-words [overflow-wrap:anywhere] ${
                m.sender === "user"
                  ? "bg-brand-navy text-white rounded-tl-none font-sans"
                  : "bot-bubble bg-surface-card border border-surface-border text-content-primary rounded-tr-none font-sans"
              }`
        }
        dangerouslySetInnerHTML={{ __html: m.html }}
      />
      {showActions && (
        <div className="flex items-center gap-1 mt-1.5">
          {/* Review is offered only after a typed question, not a selection-only flow. */}
          {askedTyped && (
            <button
              onClick={onFeedback}
              title="סיום שיחה והשארת משוב"
              aria-label="סיום שיחה והשארת משוב"
              className="p-2 rounded-md text-content-muted hover:text-bio-green hover:bg-surface-raised transition-colors dark:hover:text-bio-green-glow"
            >
              <Check size={19} strokeWidth={2.5} />
            </button>
          )}
          <button
            onClick={onNewChat}
            title="שיחה חדשה"
            aria-label="שיחה חדשה"
            className="p-2 rounded-md text-content-muted hover:text-brand-navy hover:bg-surface-raised transition-colors dark:hover:text-bio-green-glow"
          >
            <RotateCcw size={18} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

// Footer: course-suggestion dropdown + the text input / send button.
export function ChatInput({
  input,
  setInput,
  suggestions,
  showSuggestions,
  setSuggestions,
  setShowSuggestions,
  onSend,
  fetchSuggestions,
  typingTimerRef,
  isBotResponding,
  hasYearbook,
}) {
  return (
    <div className="px-3 sm:px-6 py-3 bg-surface-card border-t border-surface-border shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
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
                      setInput((prev) => {
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
                maxLength={150}
                value={input}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 150);
                  setInput(val);
                  clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => fetchSuggestions(val), 300);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                placeholder={hasYearbook ? "שאל על קורס (למשל: דרישות קדם לביוכימיה)..." : "אנא בחר שנתון קודם..."}
                className="w-full bg-surface-page rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-body text-content-primary focus:bg-surface-card transition-colors outline-none pr-12 sm:pr-14 shadow-inner font-sans placeholder:text-content-muted relative z-10"
              />
              <button
                onClick={onSend}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-brand-navy dark:bg-bio-teal text-white p-2.5 rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95 z-20"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
