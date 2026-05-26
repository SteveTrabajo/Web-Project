import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * AdminSecurity.jsx
 * -----------------
 * Admin UI component for updating sensitive admin credentials:
 * - Change admin password
 * - Change admin email
 *
 * Backend endpoints used (POST):
 * - {API_BASE}/api/admin/security/change-password
 * - {API_BASE}/api/admin/security/change-email
 */
function getAdminToken() {
  try {
    return JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token ?? null;
  } catch {
    return null;
  }
}

export default function AdminSecurity({ adminId }) {
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  const API = `${API_BASE}/api/admin/security`;

  const post = async (url, body) => {
    setMsg("");
    const token = getAdminToken();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setIsError(true);
      setMsg(data.error || "שגיאה");
      return;
    }
    setIsError(false);
    setMsg("נשמר בהצלחה");
  };

  return (
    <div className="space-y-5" dir="rtl">

      {/* Password section */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">שינוי סיסמה</p>
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs text-muted-foreground">
            סיסמה חדשה
          </Label>
          <Input
            id="new-password"
            type="password"
            placeholder="סיסמה חדשה"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => post(`${API}/change-password`, { adminId, newPassword })}
        >
          עדכן סיסמה
        </Button>
      </div>

      <Separator />

      {/* Email section */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">שינוי אימייל</p>
        <div className="space-y-1.5">
          <Label htmlFor="new-email" className="text-xs text-muted-foreground">
            אימייל חדש
          </Label>
          <Input
            id="new-email"
            type="email"
            placeholder="אימייל חדש"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => post(`${API}/change-email`, { adminId, newEmail })}
        >
          עדכן אימייל
        </Button>
      </div>

      {msg && (
        <div
          className={`text-xs rounded-xl px-3 py-2.5 border ${
            isError
              ? "text-destructive bg-destructive/10 border-destructive/20"
              : "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
