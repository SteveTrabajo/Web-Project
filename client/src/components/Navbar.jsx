import ThemeToggle from "./ThemeToggle";

export default function Navbar({ view, onNavigate }) {
  const item = (key, label) => {
    const isActive = view === key;

    return (
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onNavigate(key); }}
        className={`relative p-0.5 inline-flex items-center justify-center font-bold overflow-hidden group rounded-md text-sm
          ${isActive ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
      >
        <span className="w-full h-full bg-gradient-to-br from-[#F5B301] via-blue-500 to-[#162A5A] group-hover:from-[#162A5A] group-hover:via-blue-500 group-hover:to-[#F5B301] absolute transition-all duration-400" />
        <span className={`relative px-5 py-2 transition-all ease-out rounded-md duration-400
          ${isActive ? "bg-opacity-0 bg-[#0B1220]" : "bg-[#162A5A] group-hover:bg-opacity-0"}`}>
          <span className="relative text-white">{label}</span>
        </span>
      </a>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-[#162A5A] dark:bg-[#0B1220] border-b border-[#F5B301]/40 shadow-xl">
      <div className="w-full px-6 h-20 flex items-center">

        {/* Left - logo & brand */}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onNavigate("home"); }}
          className="flex items-center gap-4 group shrink-0"
        >
          <img
            src="/assets/logo.png"
            alt="BIO BOT"
            className="w-12 h-12 object-contain bg-white rounded-full p-1.5 ring-2 ring-white/10 group-hover:ring-[#F5B301]/50 transition-all duration-300"
          />
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white tracking-tight leading-none mb-1 uppercase">
              BIO BOT
            </span>
            <span className="text-[11px] font-medium text-blue-200 tracking-wider uppercase opacity-80">
              Braude Biotechnology Assistant
            </span>
          </div>
        </a>

        {/* Right - nav + theme toggle */}
        <div className="ml-auto flex items-center gap-4">
          <nav className="flex items-center gap-2" dir="rtl">
            {item("home", "בית")}
            {item("chat", "צ׳אט")}
            {item("labs", "לוח מעבדות")}

            <div className="w-px h-6 bg-white/20 mx-1" />

            {item("admin", "אזור מנהל")}
          </nav>

          <div className="w-px h-6 bg-white/20" />

          <ThemeToggle />
        </div>

      </div>
    </header>
  );
}
