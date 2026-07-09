import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import AdminLogin from "../AdminLogin.jsx";

import AdvisorsTab     from "./tabs/AdvisorsTab.jsx";
import LabsTab         from "./tabs/LabsTab.jsx";
import YearbooksTab    from "./tabs/YearbooksTab.jsx";
import RegistrationTab from "./tabs/RegistrationTab.jsx";
import FeedbackTab     from "./tabs/FeedbackTab.jsx";
import UnansweredTab   from "./tabs/UnansweredTab.jsx";
import FaqTab          from "./tabs/FaqTab.jsx";
import SettingsTab     from "./tabs/SettingsTab.jsx";
import StatsTab       from "./tabs/StatsTab.jsx";
import AdminForms from "../AdminForms.jsx";
import AdminKnowledgeCheck from "../AdminKnowledgeCheck.jsx";

function FormsTab() {
  return <AdminForms />;
}

function KnowledgeTab() {
  return <AdminKnowledgeCheck />;
}

const NAV_ITEMS = [
  { id: "advisors",     icon: "👨‍🏫", label: "יועצים" },
  { id: "labs",         icon: "🧪",  label: "לוחות מעבדה" },
  { id: "yearbooks",    icon: "📚",  label: "שנתון / קורסים" },
  { id: "registration", icon: "📝",  label: "ניהול סמסטר" },
  { id: "forms",        icon: "📄",  label: "טפסים" },
  { id: "knowledge",    icon: "🔍",  label: "בדיקת מאגר" },
  { id: "feedback",     icon: "💬",  label: "משובים" },
  { id: "unanswered",   icon: "❓",  label: "שאלות ללא מענה" },
  { id: "faq",          icon: "📌",  label: "תשובות מוכנות" },
  { id: "stats",        icon: "📊",  label: "סטטיסטיקות" },
  { id: "settings",     icon: "⚙️",  label: "הגדרות" },
];

const TAB_COMPONENTS = {
  advisors:     AdvisorsTab,
  labs:         LabsTab,
  yearbooks:    YearbooksTab,
  registration: RegistrationTab,
  forms:        FormsTab,
  knowledge:    KnowledgeTab,
  feedback:     FeedbackTab,
  unanswered:   UnansweredTab,
  faq:          FaqTab,
  stats:        StatsTab,
  settings:     SettingsTab,
};

/**
 * AdminShell
 * ----------
 * Dashboard shell with a collapsible icon rail on the right and a
 * single-column main area.
 * - Auth gate (login screen when not authed); auth state is owned by App
 *   and the logged-in admin info bar lives in the navbar
 * - Status banner (toast)
 * - Always-visible icon rail sticks below the top navbar (72px); expanding
 *   it overlays the content so the center box never reflows
 * - Each tab fills the remaining width with no overflow
 *
 * Each tab component manages its own data fetching, CRUD, and editor state.
 * `toast(type, msg)` is passed down so any tab can report success/error.
 */
export default function AdminShell({ admin, setAdmin }) {
  const [activeTab, setActiveTab] = useState("advisors");
  const [status, setStatus]       = useState({ type: "idle", msg: "" });
  const [navOpen, setNavOpen]     = useState(false);

  const isAuthed = !!admin;
  const toast = (type, msg) => setStatus({ type, msg });

  if (!isAuthed) {
    return (
      <div className="bg-background flex items-start justify-center px-4 pt-16">
        <div className="w-full max-w-sm">
          <Card className="p-6">
            <AdminLogin
              onSuccess={(data) => {
                setAdmin(data);
                sessionStorage.setItem("bio_admin", JSON.stringify(data));
              }}
            />
          </Card>
        </div>
      </div>
    );
  }

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-8 text-foreground">

      {/* Status banner */}
      {status.msg && (
        <div
          dir="rtl"
          className={cn(
            "mb-4 text-body rounded-2xl border px-4 py-3",
            status.type === "error"
              ? "text-destructive bg-destructive/10 border-destructive/20"
              : status.type === "ok"
              ? "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20"
              : "text-muted-foreground bg-muted border-border"
          )}
        >
          {status.msg}
        </div>
      )}

      {/* Dashboard layout: icon rail on the right, content fills the rest */}
      <div dir="rtl" className="flex gap-4 items-start">

        {/* Icon rail - always visible, sticks below the 72px navbar. The rail
            reserves a fixed 48px column; expanding widens the absolutely
            positioned card over the content, so the center box never moves */}
        <aside className="w-12 shrink-0 sticky top-[88px] z-40">
          <Card
            className={cn(
              "absolute top-0 right-0 p-1.5 gap-0 shadow-md overflow-hidden transition-[width] duration-200",
              navOpen ? "w-56" : "w-12"
            )}
          >
            <nav className="flex flex-col gap-1 max-h-[calc(100dvh-120px)] overflow-y-auto overflow-x-hidden">
              <button
                onClick={() => setNavOpen((o) => !o)}
                aria-expanded={navOpen}
                title="תפריט ניהול"
                className="flex items-center gap-2 h-9 px-2 rounded-lg text-body text-muted-foreground hover:bg-muted transition-colors w-full text-right"
              >
                <span className="w-5 flex justify-center shrink-0">
                  {navOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
                </span>
                {navOpen && <span className="truncate font-semibold">תפריט ניהול</span>}
              </button>

              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setNavOpen(false); }}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-2 h-9 px-2 rounded-lg text-body transition-colors w-full text-right",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                    {navOpen && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Main content area */}
        <main className="flex-1 min-w-0 w-full">
          <ActiveTabComponent toast={toast} />
        </main>
      </div>
    </div>
  );
}
