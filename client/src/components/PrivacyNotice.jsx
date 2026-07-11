import { Button } from "@/components/ui/button";

// One-time (per browser) privacy/transparency notice shown on first chat open.
export default function PrivacyNotice({ onAcknowledge }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 font-sans"
      onClick={onAcknowledge}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-[90%] max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-surface-card text-content-primary border border-surface-border shadow-2xl p-5 space-y-3 text-center"
      >
        <h2 className="text-heading text-brand-navy dark:text-bio-green-glow">שקיפות ופרטיות</h2>

        <div className="text-body leading-6 space-y-2 text-content-primary">
          <p>הבוט אינו אוסף מידע אישי מזהה.</p>
          <p>עם זאת, חלק מהשאלות עשויות להישמר לצורך בדיקה וניתוח סטטיסטי לשיפור הבוט.</p>
          <p className="font-semibold">
            לכן נבקש שלא לשתף פרטים מזהים בשאלות.
          </p>
          <p className="text-caption text-content-muted">
            המידע נשמר באופן אנונימי ומשמש אך ורק לשיפור המענה.
          </p>
        </div>

        <Button className="w-full h-11" onClick={onAcknowledge}>
          הבנתי
        </Button>
      </div>
    </div>
  );
}
