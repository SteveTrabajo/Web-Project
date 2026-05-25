import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const REASON_OPTIONS = [
  { key: "insufficient",  label: "המידע לא מספיק" },
  { key: "unclear",       label: "המידע לא ברור" },
  { key: "irrelevant",    label: "התשובה לא רלוונטית" },
  { key: "outdated",      label: "המידע לא עדכני" },
  { key: "missing_topic", label: "הנושא לא מכוסה בכלל" },
  { key: "other",         label: "אחר" },
];

/**
 * FeedbackModal
 * Props: isOpen, onClose, onSubmit
 */
export default function FeedbackModal({ isOpen, onClose, onSubmit }) {
  const [rating,   setRating]   = useState(null);     // "positive" | "negative" | null
  const [reasons,  setReasons]  = useState([]);        // string[]
  const [comment,  setComment]  = useState("");
  const [phase,    setPhase]    = useState("form");    // "form" | "submitting" | "done" | "error"

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Unmount cleanly between sessions
  if (!isOpen) return null;

  const toggleReason = (key) => {
    setReasons((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  };

  const pickRating = (r) => {
    setRating(r);
    if (r === "positive") setReasons([]); // clear reasons when switching to positive
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setPhase("submitting");
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reasons, comment }),
      });
      if (!res.ok) throw new Error("server error");
      setPhase("done");
      setTimeout(() => onSubmit(), 1800);
    } catch {
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">
            איך הייתה החוויה?
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
          המשוב אנונימי לחלוטין
        </p>

        {/* Form phase */}
        {phase === "form" && (
          <>
            {/* Rating buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => pickRating("positive")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                  rating === "positive"
                    ? "border-[#F5B301] bg-yellow-50 dark:bg-yellow-900/20"
                    : "border-gray-200 dark:border-slate-700 hover:border-[#162A5A] dark:hover:border-blue-400"
                }`}
              >
                <span className="text-2xl">👍</span>
                <span className="text-gray-700 dark:text-slate-200">עזר לי</span>
              </button>
              <button
                onClick={() => pickRating("negative")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                  rating === "negative"
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-200 dark:border-slate-700 hover:border-red-400"
                }`}
              >
                <span className="text-2xl">👎</span>
                <span className="text-gray-700 dark:text-slate-200">לא עזר</span>
              </button>
            </div>

            {/* Reason checkboxes — shown only for negative */}
            {rating === "negative" && (
              <div className="mb-4 space-y-2 rounded-xl border border-gray-100 dark:border-slate-800 p-3 bg-gray-50 dark:bg-slate-950">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">
                  מה הייתה הבעיה? (אפשר לסמן כמה)
                </p>
                {REASON_OPTIONS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={reasons.includes(key)}
                      onChange={() => toggleReason(key)}
                      className="accent-[#162A5A] w-4 h-4"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {/* Comment textarea */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="הערות נוספות (אופציונלי)..."
              rows={3}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-[#162A5A] transition-all mb-4"
            />

            {/* Footer */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
              >
                דלג
              </button>
              <button
                onClick={handleSubmit}
                disabled={!rating}
                className="px-6 py-2 rounded-full bg-[#162A5A] text-white text-sm font-semibold hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                שלח משוב
              </button>
            </div>
          </>
        )}

        {/* Submitting */}
        {phase === "submitting" && (
          <div className="py-8 flex flex-col items-center gap-3 text-gray-500 dark:text-slate-400">
            <div className="w-8 h-8 border-4 border-[#162A5A] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">שולח...</span>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <span className="text-4xl">🙏</span>
            <p className="text-base font-semibold text-gray-800 dark:text-slate-100">
              תודה על המשוב!
            </p>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="py-6 flex flex-col items-center gap-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              ⚠️ שגיאת שרת. אנא נסה שוב.
            </p>
            <button
              onClick={() => setPhase("form")}
              className="px-5 py-2 rounded-full bg-[#162A5A] text-white text-sm font-semibold hover:bg-blue-900 transition-all"
            >
              נסה שוב
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
