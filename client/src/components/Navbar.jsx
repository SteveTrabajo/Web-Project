import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar({ view, onNavigate, admin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const item = (key, label, fullWidth = false) => {
    const isActive = view === key;

    return (
      <button
        key={key}
        type="button"
        onClick={() => { onNavigate(key); setMenuOpen(false); }}
        className={`px-5 py-2 rounded-lg text-body tracking-wide transition-all duration-250 ease-out
          hover:-translate-y-px active:translate-y-0 active:scale-95
          ${fullWidth ? "w-full text-right" : ""}
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
    <header className="sticky top-0 z-50 bg-brand-navy dark:bg-brand-navy-deep border-b border-bio-green-glow/20 shadow-[0_2px_20px_rgba(0,0,0,0.25)] relative">
      <div className="w-full px-4 md:px-8 h-[72px] flex items-center justify-between">

        {/* Left - logo, brand, admin info */}
        <div className="flex items-center gap-5 shrink-0">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate("home"); setMenuOpen(false); }}
            className="flex items-center gap-3.5 group"
          >
            <img
              src="/assets/logo.png"
              alt="BIO BOT"
              className="w-11 h-11 object-contain bg-white rounded-full p-1 ring-2 ring-white/10 group-hover:ring-bio-green-glow/60 transition-all duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-page-title text-white leading-none uppercase">
                BIO BOT 2.0
              </span>
              <span className="text-caption text-blue-200/70 tracking-widest uppercase">
                Braude Biotechnology Assistant
              </span>
            </div>
          </a>

          {admin && (
            <>
              <div className="hidden md:block w-px h-7 bg-white/15 mx-1" />
              <div className="hidden md:flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5">
                <div className="text-right leading-tight min-w-0">
                  <p className="text-caption font-semibold text-bio-green-glow">
                    מחובר כמנהל ✓
                  </p>
                  <p className="text-caption text-white/60 truncate max-w-[160px]">
                    {admin.email}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={onLogout}>
                  התנתקות
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Right - desktop nav */}
        <nav className="hidden md:flex items-center gap-1.5" dir="rtl">
          {item("home", "בית")}
          {item("chat", "צ׳אט")}
          {item("labs", "לוח מעבדות")}

          <div className="w-px h-5 bg-white/15 mx-3" />

          {item("admin", "אזור מנהל")}
        </nav>

        {/* Right - mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
          aria-expanded={menuOpen}
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-white/75 border border-transparent hover:text-white hover:bg-white/8 hover:border-white/15 transition-colors"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav
          dir="rtl"
          className="md:hidden absolute top-full inset-x-0 z-50 bg-brand-navy dark:bg-brand-navy-deep border-b border-bio-green-glow/20 shadow-[0_8px_20px_rgba(0,0,0,0.35)] flex flex-col p-2 gap-1"
        >
          {item("home", "בית", true)}
          {item("chat", "צ׳אט", true)}
          {item("labs", "לוח מעבדות", true)}
          {item("admin", "אזור מנהל", true)}

          {admin && (
            <div className="flex items-center justify-between gap-3 border-t border-white/15 mt-1 pt-2 px-2 pb-1">
              <div className="text-right leading-tight min-w-0">
                <p className="text-caption font-semibold text-bio-green-glow">
                  מחובר כמנהל ✓
                </p>
                <p className="text-caption text-white/60 truncate max-w-[200px]">
                  {admin.email}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { onLogout(); setMenuOpen(false); }}
              >
                התנתקות
              </Button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
