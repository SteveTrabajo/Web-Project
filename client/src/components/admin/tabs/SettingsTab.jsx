import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiFetch, getAdmin } from "../utils/adminApi";

function FeedbackBanner({ msg, isError }) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "text-caption rounded-xl px-3 py-2.5 border",
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

  // ---------- Yearbook deletion state ----------
  const [yearbooks, setYearbooks]         = useState([]);
  const [ybToDelete, setYbToDelete]       = useState("");
  const [impact, setImpact]               = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [confirmText, setConfirmText]     = useState("");
  const [alsoDeleteLabs, setAlsoDeleteLabs] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteOpen, setDeleteOpen]       = useState(false);

  const loadYearbooks = async () => {
    try {
      const data = await apiFetch("/api/admin/yearbooks", { force: true });
      setYearbooks(data.yearbooks || []);
    } catch {
      // a failed list just leaves the danger zone empty
    }
  };

  useEffect(() => { loadYearbooks(); }, []);

  // Fetches what a delete would remove, so the admin sees the scope first.
  const openDeleteDialog = async (id) => {
    setYbToDelete(id);
    setImpact(null);
    setConfirmText("");
    setAlsoDeleteLabs(false);
    setImpactLoading(true);
    setDeleteOpen(true);
    try {
      const data = await apiFetch(
        `/api/admin/yearbooks/${encodeURIComponent(id)}/delete-impact`,
        { force: true }
      );
      setImpact(data.impact);
    } catch (e) {
      toast("error", e.message);
      setDeleteOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const deleteYearbook = async () => {
    setDeleting(true);
    try {
      const data = await apiFetch(`/api/admin/yearbooks/${encodeURIComponent(ybToDelete)}`, {
        method: "DELETE",
        body: { confirm: ybToDelete, deleteLabSchedule: alsoDeleteLabs },
      });
      const d = data.deleted || {};
      toast("ok", `השנתון נמחק (${d.courses || 0} קורסים, ${d.semesters || 0} סמסטרים).`);
      setDeleteOpen(false);
      setYbToDelete("");
      setImpact(null);
      setConfirmText("");
      loadYearbooks();
    } catch (e) {
      toast("error", e.message);
    } finally {
      setDeleting(false);
    }
  };

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
            <p className="text-caption text-muted-foreground mt-0.5">בחר סיסמה חדשה לחשבון המנהל</p>
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
            <p className="text-caption text-muted-foreground mt-0.5">עדכן את כתובת המייל של חשבון המנהל</p>
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

        <Separator />

        {/* Danger zone - irreversible data removal */}
        <section className="space-y-3">
          <div>
            <h3 className="text-heading text-destructive">אזור מסוכן</h3>
            <p className="text-caption text-muted-foreground mt-0.5">
              מחיקת שנתון מוחקת לצמיתות את כל הסמסטרים, הקורסים ודרישות הקדם שלו. הפעולה אינה ניתנת לביטול.
            </p>
          </div>

          <div className="rounded-xl border border-destructive/20 divide-y divide-border overflow-hidden">
            {yearbooks.length === 0 && (
              <div className="p-3 text-caption text-muted-foreground">לא נמצאו שנתונים.</div>
            )}
            {yearbooks.map((yb) => (
              <div key={yb.id} className="flex items-center justify-between gap-3 p-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-body font-medium text-foreground truncate">
                    {yb.displayName || yb.id}
                  </div>
                  <div className="text-caption text-muted-foreground font-mono">{yb.id}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => openDeleteDialog(yb.id)}
                >
                  מחיקה
                </Button>
              </div>
            ))}
          </div>
        </section>

      </CardContent>

      {/* Delete-yearbook confirmation, showing the scope before it happens */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setConfirmText(""); setImpact(null); } }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">מחיקת שנתון</DialogTitle>
          </DialogHeader>

          {impactLoading && (
            <div className="py-6 text-center text-body text-muted-foreground animate-pulse">
              בודק מה יימחק...
            </div>
          )}

          {!impactLoading && impact && (
            <div className="space-y-4">
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 space-y-1.5 text-caption text-destructive">
                <div className="font-semibold">
                  {impact.displayName}
                  <span className="font-mono font-normal opacity-80"> ({impact.yearbookId})</span>
                </div>
                <div>יימחקו לצמיתות: {impact.counts.semesters} סמסטרים · {impact.counts.courses} קורסים · {impact.counts.relations} דרישות קדם.</div>
              </div>

              {impact.isLastYearbook && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 text-caption text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300">
                  זהו השנתון האחרון. לאחר מחיקתו לא יהיה שנתון לבחירה בצ׳אט עד להעלאת שנתון חדש.
                </div>
              )}

              {impact.curatedAnswers > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-caption text-muted-foreground">
                  {impact.curatedAnswers} תשובות מוכנות משויכות לשנתון זה. הן לא יימחקו, אך יישארו ללא שנתון קיים - אפשר לעדכן אותן בטאב התשובות המוכנות.
                </div>
              )}

              {impact.labSchedule.exists && (
                <label className="flex items-start gap-2 text-body cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={alsoDeleteLabs}
                    onChange={(e) => setAlsoDeleteLabs(e.target.checked)}
                  />
                  <span>
                    למחוק גם את לוח המעבדות המשויך
                    <span className="text-caption text-muted-foreground block">
                      {impact.labSchedule.semesters} סמסטרים ב-lab_schedule עם אותו מזהה. אם לא יימחק, הוא יישאר ללא שנתון תואם.
                    </span>
                  </span>
                </label>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="confirm-yearbook">
                  להקלדה לאישור: <span className="font-mono">{impact.yearbookId}</span>
                </Label>
                <Input
                  id="confirm-yearbook"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={impact.yearbookId}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-row gap-2 justify-start">
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={deleteYearbook}
              disabled={deleting || !impact || confirmText !== impact?.yearbookId}
            >
              {deleting ? "מוחק..." : "מחיקה לצמיתות"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
