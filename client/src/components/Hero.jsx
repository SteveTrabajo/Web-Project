import { BookOpen, Users, FlaskConical, ArrowLeft } from "lucide-react";

const FEATURES = [
  { Icon: BookOpen, label: "קורסים ודרישות קדם" },
  { Icon: Users, label: "יועצים אקדמיים" },
  { Icon: FlaskConical, label: "לוחות מעבדה" },
];

export default function Hero({ onStart, onLabs }) {
  return (
    <section
      className="relative w-full flex-1 min-h-0 bg-cover bg-center bg-no-repeat overflow-hidden flex items-center"
      style={{ backgroundImage: "url(/assets/background.png)" }}
      dir="rtl"
    >
      {/* Layered gradient overlay - deepens the image and anchors the card */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-brand-navy/70 via-brand-navy/45 to-brand-navy-deep/80" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_90%_at_50%_0%,transparent_35%,rgba(11,18,32,0.55)_100%)]" />

      {/* Content centered on screen */}
      <div className="relative z-10 w-full flex justify-center px-6">

        {/* Glass card */}
        <div className="backdrop-blur-md bg-brand-navy/45 border border-white/12 rounded-3xl px-6 py-9 sm:px-12 sm:py-12 max-w-2xl w-full text-center text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-500">

          {/* Hero display text intentionally larger than the standard scale */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight animate-in fade-in slide-in-from-bottom-3 duration-500">
            עוזר חכם לסטודנטים
            <br />
            <span className="bg-gradient-to-l from-brand-gold to-brand-gold-hover bg-clip-text text-transparent">
              הנדסת ביוטכנולוגיה
            </span>
          </h1>

          <p className="mt-4 text-body text-blue-100/90 leading-relaxed max-w-lg mx-auto">
            שאלו בשפה חופשית על קורסים, דרישות קדם, יועצים ולוחות מעבדה - וקבלו תשובה מיידית מבוססת נתוני המחלקה.
          </p>

          {/* Feature chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {FEATURES.map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3.5 py-1.5 text-caption font-medium text-blue-50/90 backdrop-blur-sm"
              >
                <Icon className="w-4 h-4 text-bio-green-glow" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStart}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-3.5 rounded-full bg-brand-gold text-brand-navy text-heading shadow-[0_10px_30px_-8px_rgba(245,179,1,0.6)] transition-all duration-200 hover:scale-[1.03] hover:bg-brand-gold-hover active:scale-95"
            >
              התחלת צ׳אט
              <ArrowLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" strokeWidth={2.5} />
            </button>
            <button
              onClick={onLabs}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border border-white/25 bg-white/5 text-heading text-white transition-all duration-200 hover:bg-white/12 hover:border-white/40 active:scale-95"
            >
              <FlaskConical className="w-5 h-5" strokeWidth={2} />
              לוח מעבדות
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
