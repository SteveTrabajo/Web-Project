import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiFetch, getAdmin } from "../utils/adminApi";

function FeedbackBanner({ msg, isError }) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "text-xs rounded-xl px-3 py-2.5 border",
        isError
          ? "text-destructive bg-destructive/10 border-destructive/20"
          : "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20"
      )}
    >
      {msg}
    </div>
  );
}

export default function SettingsTab({ toast }) {
  const admin = getAdmin();
  const adminId = admin?.id ?? admin?.uid;

  // ---------- Password state ----------
  const [newPassword, setNewPassword]     = useState("");
  const [pwMsg, setPwMsg]                 = useState("");
  const [pwError, setPwError]             = useState(false);
  const [pwSaving, setPwSaving]           = useState(false);

  // ---------- Email state ----------
  const [newEmail, setNewEmail]           = useState("");
  const [emailMsg, setEmailMsg]           = useState("");
  const [emailError, setEmailError]       = useState(false);
  const [emailSaving, setEmailSaving]     = useState(false);

  const updatePassword = async () => {
    setPwMsg("");
    if (!newPassword) {
      setPwError(true);
      setPwMsg("נא להזין סיסמה חדשה");
      return;
    }
    setPwSaving(true);
    try {
      await apiFetch("/api/admin/security/change-password", {
        method: "POST",
        body: { adminId, newPassword },
      });
      setPwError(false);
      setPwMsg("הסיסמה עודכנה בהצלחה");
      setNewPassword("");
      toast("ok", "הסיסמה עודכנה");
    } catch (e) {
      setPwError(true);
      setPwMsg(e.message || "שגיאה");
    } finally {
      setPwSaving(false);
    }
  };

  const updateEmail = async () => {
    setEmailMsg("");
    if (!newEmail) {
      setEmailError(true);
      setEmailMsg("נא להזין אימייל חדש");
      return;
    }
    setEmailSaving(true);
    try {
      await apiFetch("/api/admin/security/change-email", {
        method: "POST",
        body: { adminId, newEmail },
      });
      setEmailError(false);
      setEmailMsg("האימייל עודכן בהצלחה");
      setNewEmail("");
      toast("ok", "האימייל עודכן");
    } catch (e) {
      setEmailError(true);
      setEmailMsg(e.message || "שגיאה");
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">

        <div className="space-y-1">
          <h2 className="text-heading">הגדרות</h2>
          <p className="text-body text-muted-foreground">ניהול חשבון מנהל</p>
        </div>

        <Separator />

        {/* Password section */}
        <section className="space-y-3 max-w-md">
          <div>
            <h3 className="text-heading text-foreground">שינוי סיסמה</h3>
            <p className="text-caption mt-0.5">בחר סיסמה חדשה לחשבון המנהל</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">סיסמה חדשה</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <Button onClick={updatePassword} disabled={pwSaving}>
            {pwSaving ? "מעדכן..." : "עדכן סיסמה"}
          </Button>

          <FeedbackBanner msg={pwMsg} isError={pwError} />
        </section>

        <Separator />

        {/* Email section */}
        <section className="space-y-3 max-w-md">
          <div>
            <h3 className="text-heading text-foreground">שינוי אימייל</h3>
            <p className="text-caption mt-0.5">עדכן את כתובת המייל של חשבון המנהל</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-email">אימייל חדש</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="admin@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <Button onClick={updateEmail} disabled={emailSaving}>
            {emailSaving ? "מעדכן..." : "עדכן אימייל"}
          </Button>

          <FeedbackBanner msg={emailMsg} isError={emailError} />
        </section>

      </CardContent>
    </Card>
  );
}
