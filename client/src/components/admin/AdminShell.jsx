import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdminLogin from "../AdminLogin.jsx";
import AdminSecurity from "../AdminSecurityUI.jsx";

import AdvisorsTab     from "./tabs/AdvisorsTab.jsx";
import LabsTab         from "./tabs/LabsTab.jsx";
import YearbooksTab    from "./tabs/YearbooksTab.jsx";
import RegistrationTab from "./tabs/RegistrationTab.jsx";
import FeedbackTab     from "./tabs/FeedbackTab.jsx";

/**
 * AdminShell
 * ----------
 * Top-level admin layout. Owns:
 * - Authentication gate (login screen when not authed)
 * - Page header (title + admin info card with security/logout buttons)
 * - Security settings dialog
 * - Global status toast banner
 * - Tab navigation strip
 *
 * Each tab component manages its own data fetching and CRUD state.
 * `toast(type, msg)` is passed down so any tab can report success/error.
 */
export default function AdminShell() {
  const [admin, setAdmin] = useState(() =>
    JSON.parse(sessionStorage.getItem("bio_admin") || "null")
  );
  const [showSecurity, setShowSecurity] = useState(false);
  const [activeTab, setActiveTab]       = useState("advisors");
  const [status, setStatus]             = useState({ type: "idle", msg: "" });

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

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 text-foreground">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4" dir="rtl">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-brand-navy dark:text-bio-green-glow">אזור מנהל</h1>
          <p className="text-sm text-muted-foreground">הנחיות רישום · ניהול יועצים · לוחות מעבדה · שנתון וקורסים</p>
        </div>

        <Card className="p-3 w-fit min-w-[220px]">
          <CardContent className="p-0 space-y-2 text-center">
            <p className="text-sm font-semibold text-bio-green dark:text-bio-green-glow">מחובר כמנהל ✅</p>
            <p className="text-xs text-muted-foreground break-all">{admin.email}</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowSecurity(true)}>
                אבטחה
              </Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={handleLogout}>
                התנתקות
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Dialog */}
      <Dialog open={showSecurity} onOpenChange={setShowSecurity}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>הגדרות אבטחה</DialogTitle>
          </DialogHeader>
          <AdminSecurity adminId={admin.id ?? admin.uid} />
        </DialogContent>
      </Dialog>

      {/* Status banner */}
      {status.msg && (
        <div
          dir="rtl"
          className={`mb-4 text-sm rounded-2xl border px-4 py-3 ${
            status.type === "error"
              ? "text-destructive bg-destructive/10 border-destructive/20"
              : status.type === "ok"
              ? "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20"
              : "text-muted-foreground bg-muted border-border"
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tab strip rendered LTR so flex order matches reading order,
            even though tab content is RTL */}
        <div dir="ltr">
          <TabsList className="flex flex-wrap h-auto justify-start gap-1 mb-4 p-1 w-full">
            <TabsTrigger value="advisors">👨‍🏫 יועצים</TabsTrigger>
            <TabsTrigger value="labs">🧪 לוחות מעבדה</TabsTrigger>
            <TabsTrigger value="yearbooks">📚 שנתון / קורסי חובה</TabsTrigger>
            <TabsTrigger value="registration">📝 הנחיות רישום</TabsTrigger>
            <TabsTrigger value="feedback">💬 משובים</TabsTrigger>
          </TabsList>
        </div>

        <div dir="rtl">
          <TabsContent value="advisors"><AdvisorsTab toast={toast} /></TabsContent>
          <TabsContent value="labs"><LabsTab toast={toast} /></TabsContent>
          <TabsContent value="yearbooks"><YearbooksTab toast={toast} /></TabsContent>
          <TabsContent value="registration"><RegistrationTab toast={toast} /></TabsContent>
          <TabsContent value="feedback"><FeedbackTab toast={toast} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
