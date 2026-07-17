import { useState } from "react";
import { Menu, X, Home, MessageCircle, FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { key: "home", label: "בית", Icon: Home },
  { key: "chat", label: "צ׳אט", Icon: MessageCircle },
  { key: "labs", label: "לוח מעבדות", Icon: FlaskConical },
];

export default function Navbar({ view, onNavigate, admin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const item = ({ key, label, Icon }, fullWidth = false) => {
    const isActive = view === key;

    return (
      <button
        key={key}
        type="button"
        onClick={() => { onNavigate(key); setMenuOpen(false); }}
        aria-current={isActive ? "page" : undefined}
        className={`group relative flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-body tracking-wide transition-all duration-250 ease-out
          hover:-translate-y-px active:translate-y-0 active:scale-95
          ${fullWidth ? "w-full justify-start" : ""}
          ${isActive
            ? "text-bio-green-glow bg-bio-green-glow/10 border border-bio-green-glow/40 shadow-[0_0_18px_rgba(52,211,153,0.18)]"
            : "text-white/75 border border-transparent hover:text-white hover:bg-white/10 hover:border-white/15"
          }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-transform duration-250 group-hover:scale-110 ${isActive ? "text-bio-green-glow" : "text-white/55 group-hover:text-white"}`}
          strokeWidth={2}
        />
        <span>{label}</span>
      </button>
    );
  };

  const adminBadge = (
    <div className="flex items-center gap-3 rounded-xl border border-bio-green-glow/25 bg-bio-green-glow/8 px-3 py-1.5">
      <div className="text-right leading-tight min-w-0">
        <p className="text-caption font-semibold text-bio-green-glow flex items-center gap-1 justify-end">
          מחובר כמנהל
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
        </p>
        <p className="text-caption text-white/60 truncate max-w-[120px] xl:max-w-[180px]">
          {admin?.email}
        </p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => { onLogout(); setMenuOpen(false); }}>
        התנתקות
      </Button>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 brand-nav-surface shadow-[0_4px_24px_rgba(0,0,0,0.28)]">
      <div className="w-full px-4 md:px-8 h-[72px] flex items-center justify-between">

        {/* Left - logo, brand, admin info */}
        <div className="flex items-center gap-3 xl:gap-5 min-w-0">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate("home"); setMenuOpen(false); }}
            className="flex items-center gap-3.5 group min-w-0"
          >
            <span className="relative shrink-0">
              <span className="absolute inset-0 rounded-full bg-bio-green-glow/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img
                src="/assets/logo.png"
                alt="BIO BOT"
                className="relative w-11 h-11 object-contain bg-white rounded-full p-1 ring-2 ring-white/10 group-hover:ring-bio-green-glow/60 transition-all duration-300 group-hover:scale-105"
              />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-page-title text-white leading-none uppercase truncate">
                BIO BOT 2.0
              </span>
              <span className="hidden xl:block text-caption text-blue-200/70 tracking-widest uppercase truncate">
                Braude Biotechnology Assistant
              </span>
            </div>
          </a>

          {admin && (
            <>
              <div className="hidden lg:block w-px h-7 bg-white/15 mx-1" />
              <div className="hidden lg:block">{adminBadge}</div>
            </>
          )}
        </div>

        {/* Right - desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5" dir="rtl">
          {NAV_ITEMS.map((it) => item(it))}

          <div className="w-px h-5 bg-white/15 mx-1.5 xl:mx-3" />

          {item({ key: "admin", label: "אזור מנהל", Icon: ShieldCheck })}
        </nav>

        {/* Right - mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
          aria-expanded={menuOpen}
          className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl text-white/80 border border-white/10 bg-white/5 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

      </div>

      {/* Luminous hairline under the bar */}
      <div className="h-px w-full brand-hairline" />

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav
          dir="rtl"
          className="lg:hidden absolute top-full inset-x-0 z-50 brand-nav-surface border-b border-bio-green-glow/20 shadow-[0_12px_28px_rgba(0,0,0,0.4)] flex flex-col p-2.5 gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {NAV_ITEMS.map((it) => item(it, true))}
          {item({ key: "admin", label: "אזור מנהל", Icon: ShieldCheck }, true)}

          {admin && (
            <div className="border-t border-white/15 mt-1 pt-2.5 px-1">
              {adminBadge}
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
