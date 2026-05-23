import ThemeToggle from "./ThemeToggle";

export default function Navbar({ view, onNavigate }) {
  const item = (key, label) => {
    const isActive = view === key;

    return (
      <button
        type="button"
        onClick={() => onNavigate(key)}
        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors duration-200
          ${isActive
            ? "bg-white/10 text-[#F5B301]"
            : "text-white/80 hover:text-white hover:bg-white/8"
          }`}
      >
        {label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-[#162A5A] dark:bg-[#0B1220] border-b border-[#F5B301]/40 shadow-xl">
      <div className="w-full px-6 h-16 flex items-center justify-between">

        {/* Left - logo, brand, theme toggle */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate("home"); }}
            className="flex items-center gap-3 group"
          >
            <img
              src="/assets/logo.png"
              alt="BIO BOT"
              className="w-10 h-10 object-contain bg-white rounded-full p-1 ring-2 ring-white/10 group-hover:ring-[#F5B301]/50 transition-all duration-300"
            />
            <div className="flex flex-col">
              <span className="text-lg font-black text-white tracking-tight leading-none uppercase">
                BIO BOT
              </span>
              <span className="text-[10px] font-medium text-blue-200 tracking-wider uppercase opacity-70">
                Braude Biotechnology Assistant
              </span>
            </div>
          </a>

          <div className="w-px h-6 bg-white/20" />

          <ThemeToggle />
        </div>

        {/* Right - nav */}
        <nav className="flex items-center gap-1" dir="rtl">
          {item("home", "בית")}
          {item("chat", "צ׳אט")}
          {item("labs", "לוח מעבדות")}

          <div className="w-px h-5 bg-white/20 mx-2" />

          {item("admin", "אזור מנהל")}
        </nav>

      </div>
    </header>
  );
}
