import ThemeToggle from "./ThemeToggle";

export default function Navbar({ view, onNavigate }) {
  const item = (key, label) => {
    const isActive = view === key;

    return (
      <button
        type="button"
        onClick={() => onNavigate(key)}
        className={`px-5 py-2 rounded-lg text-base tracking-wide transition-all duration-250 ease-out
          hover:-translate-y-px active:translate-y-0 active:scale-95
          ${isActive
            ? "text-bio-green-glow bg-bio-green-glow/10 border border-bio-green-glow/50 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
            : "text-white/75 border border-transparent hover:text-white hover:bg-white/8 hover:border-white/15"
          }`}
      >
        {label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-brand-navy dark:bg-brand-navy-deep border-b border-bio-green-glow/20 shadow-[0_2px_20px_rgba(0,0,0,0.25)]">
      <div className="w-full px-8 h-[72px] flex items-center justify-between">

        {/* Left - logo, brand, theme toggle */}
        <div className="flex items-center gap-5 shrink-0">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate("home"); }}
            className="flex items-center gap-3.5 group"
          >
            <img
              src="/assets/logo.png"
              alt="BIO BOT"
              className="w-11 h-11 object-contain bg-white rounded-full p-1 ring-2 ring-white/10 group-hover:ring-bio-green-glow/60 transition-all duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-black text-white tracking-tight leading-none uppercase">
                BIO BOT 2.0
              </span>
              <span className="text-[11px] text-blue-200/70 tracking-widest uppercase">
                Braude Biotechnology Assistant
              </span>
            </div>
          </a>

          <div className="w-px h-7 bg-white/15 mx-1" />

          <ThemeToggle />
        </div>

        {/* Right - nav */}
        <nav className="flex items-center gap-1.5" dir="rtl">
          {item("home", "בית")}
          {item("chat", "צ׳אט")}
          {item("labs", "לוח מעבדות")}

          <div className="w-px h-5 bg-white/15 mx-3" />

          {item("admin", "אזור מנהל")}
        </nav>

      </div>
    </header>
  );
}
