import { useState } from "react";
import { Button } from "@/components/ui/button";
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
 * Dashboard shell with right-side vertical sidebar and single-column main area.
 * - Auth gate (login screen when not authed)
 * - Header with page title and inline admin info bar
 * - Status banner (toast)
 * - Sticky sidebar nav on the right (RTL)
 * - Each tab fills the remaining width with no overflow
 *
 * Each tab component manages its own data fetching, CRUD, and editor state.
 * `toast(type, msg)` is passed down so any tab can report success/error.
 */
export default function AdminShell() {
  const [admin, setAdmin] = useState(() =>
    JSON.parse(sessionStorage.getItem("bio_admin") || "null")
  );
  const [activeTab, setActiveTab] = useState("advisors");
  const [status, setStatus]       = useState({ type: "idle", msg: "" });

  const isAuthed = !!admin;
  const toast = (type, msg) => setStatus({ type, msg });
  const handleLogout = () => {
    setAdmin(null);
    sessionStorage.removeItem("bio_admin");
  };

  if (!isAuthed) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-background flex items-center justify-center px-4">
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
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 text-foreground">

      {/* Header bar */}
      <header className="flex items-center justify-between gap-4 flex-wrap mb-6" dir="rtl">
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-page-title text-brand-navy dark:text-bio-green-glow truncate">
            אזור מנהל
          </h1>
          <p className="text-caption text-muted-foreground">
            ניהול יועצים, לוחות מעבדה, שנתון וקורסים
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2 shadow-sm">
          <div className="text-right min-w-0">
            <p className="text-caption font-semibold text-bio-green dark:text-bio-green-glow">
              מחובר כמנהל ✓
            </p>
            <p className="text-caption text-muted-foreground truncate max-w-[160px]">
              {admin.email}
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            התנתקות
          </Button>
        </div>
      </header>

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

      {/* Dashboard layout: sidebar on right, content on left */}
      <div dir="rtl" className="flex flex-col md:flex-row gap-4 items-start">

        {/* Right sidebar (visible right in RTL) */}
        <aside className="w-full md:w-56 md:shrink-0">
          <Card className="p-2 md:sticky md:top-4">
            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-body transition-colors text-right shrink-0 md:w-full",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
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
