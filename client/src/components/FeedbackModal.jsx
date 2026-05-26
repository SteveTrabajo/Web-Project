import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [rating,  setRating]  = useState(null);
  const [reasons, setReasons] = useState([]);
  const [comment, setComment] = useState("");
  const [phase,   setPhase]   = useState("form");

  const toggleReason = (key) => {
    setReasons((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  };

  const pickRating = (r) => {
    setRating(r);
    if (r === "positive") setReasons([]);
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

  const handleOpenChange = (open) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-heading text-foreground">
            איך הייתה החוויה?
          </DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">
            המשוב אנונימי לחלוטין
          </DialogDescription>
        </DialogHeader>

        {/* Form phase */}
        {phase === "form" && (
          <div className="space-y-4">
            {/* Rating buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => pickRating("positive")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-body font-medium transition-all ${
                  rating === "positive"
                    ? "border-brand-gold bg-brand-gold/10"
                    : "border-border hover:border-primary"
                }`}
              >
                <span className="text-2xl">👍</span>
                <span className="text-foreground">עזר לי</span>
              </button>
              <button
                onClick={() => pickRating("negative")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-body font-medium transition-all ${
                  rating === "negative"
                    ? "border-destructive bg-destructive/10"
                    : "border-border hover:border-destructive"
                }`}
              >
                <span className="text-2xl">👎</span>
                <span className="text-foreground">לא עזר</span>
              </button>
            </div>

            {/* Reason checkboxes */}
            {rating === "negative" && (
              <div className="rounded-xl border border-border p-3 bg-muted/40 space-y-2">
                <p className="text-caption font-semibold text-muted-foreground mb-2">
                  מה הייתה הבעיה? (אפשר לסמן כמה)
                </p>
                {REASON_OPTIONS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`reason-${key}`}
                      checked={reasons.includes(key)}
                      onCheckedChange={() => toggleReason(key)}
                    />
                    <Label
                      htmlFor={`reason-${key}`}
                      className="text-body text-foreground cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {/* Comment */}
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="הערות נוספות (אופציונלי)..."
              rows={3}
              className="resize-none"
            />

            {/* Footer */}
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={onClose}>
                דלג
              </Button>
              <Button onClick={handleSubmit} disabled={!rating}>
                שלח משוב
              </Button>
            </div>
          </div>
        )}

        {/* Submitting */}
        {phase === "submitting" && (
          <div className="py-8 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-body">שולח...</span>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <span className="text-4xl">🙏</span>
            <p className="text-heading text-foreground">תודה על המשוב!</p>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="py-6 flex flex-col items-center gap-4">
            <p className="text-body text-destructive">שגיאת שרת. אנא נסה שוב.</p>
            <Button onClick={() => setPhase("form")}>נסה שוב</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
