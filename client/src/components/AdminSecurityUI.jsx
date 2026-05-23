import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";


/**
 * AdminSecurity.jsx
 * -----------------
 * Admin UI component for updating sensitive admin credentials:
 * - Change admin password
 * - Change admin email
 *
 * This component is typically shown inside a modal (e.g., from AdminPanel).
 *
 * Backend endpoints used (POST):
 * - {API_BASE}/api/admin/security/change-password
 * - {API_BASE}/api/admin/security/change-email
 *
 * Request body:
 * - change-password: { adminId, newPassword }
 * - change-email:    { adminId, newEmail }
 *
 * Notes:
 * - This component does NOT manage authentication itself.
 * - It assumes the backend enforces authorization/validation.
 * - "adminId" is passed from parent (AdminPanel). In your codebase, it replaces "uid".
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
      setMsg(data.error || "שגיאה");
      return;
    }

    setMsg("✅ נשמר בהצלחה");
  };

  return (
    <div className="space-y-6">
      {/* Password Update Section */}
      <div>
        <div className="font-semibold mb-1">🔐 שינוי סיסמה</div>

        {/* New password input (controlled) */}
        <input
          type="password"
          placeholder="סיסמה חדשה"
          className="w-full border rounded-xl px-3 py-2"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        {/* Trigger password update request */}
        <button
          className="mt-2 text-sm text-blue-600 underline"
          onClick={() =>
            post(`${API}/change-password`, {
              adminId,      // admin identifier (used instead of uid)
              newPassword,  // new password to be set
            })
          }
        >
          עדכן סיסמה
        </button>
      </div>

      {/* Email Update Section */}
      <div>
        <div className="font-semibold mb-1">✉️ שינוי אימייל</div>

        {/* New email input (controlled) */}
        <input
          type="email"
          placeholder="אימייל חדש"
          className="w-full border rounded-xl px-3 py-2"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />

        {/* Trigger email update request */}
        <button
          className="mt-2 text-sm text-blue-600 underline"
          onClick={() =>
            post(`${API}/change-email`, {
              adminId,    // admin identifier (used instead of uid)
              newEmail,   // new email to be set
            })
          }
        >
          עדכן אימייל
        </button>
      </div>

      {/* Feedback message (success/error) */}
      {msg && <div className="text-sm text-green-600">{msg}</div>}
    </div>
  );
}