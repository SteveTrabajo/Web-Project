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
export default function AdminSecurity({ adminId }) {
  // Controlled inputs for new credentials
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Feedback message shown to the admin (success / error)
  const [msg, setMsg] = useState("");

  // Base path for all security actions
  const API = `${API_BASE}/api/admin/security`;

  /**
   * post(url, body)
   * --------------
   * Generic helper to POST JSON to the backend.
   * - Clears the current message
   * - Sends request and parses JSON response
   * - Displays error message from server if request fails
   * - Displays success message if request succeeds
   *
   * Important:
   * - No authorization header is added here.
   *   If your backend expects a token, it must be added at a higher layer or here.
   */
  const post = async (url, body) => {
    setMsg("");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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