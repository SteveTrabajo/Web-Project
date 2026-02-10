import { useState } from "react";

/**
 * AdminLogin Component
 * --------------------
 * This component handles administrator authentication and password recovery.
 * 
 * Supported modes:
 * - login  : Standard email + password login
 * - forgot : Request a password reset code via email
 * - reset  : Enter received code and set a new password
 * 
 * The component communicates with backend admin authentication endpoints.
 * On successful login, it calls the `onSuccess` callback with admin data.
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3000";

const ADMIN_API = `${API_BASE}/api/admin`;

export default function AdminLogin({ onSuccess }) {
  // Form state fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  // Current UI mode: "login" | "forgot" | "reset"
  const [mode, setMode] = useState("login");

  // Message for success / error feedback
  const [msg, setMsg] = useState("");

  /**
   * Sends login request to backend.
   * If successful → passes returned admin data to parent component.
   */
  const login = async () => {
    setMsg("");
    const res = await fetch(`${ADMIN_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    onSuccess(data);
  };

  /**
   * Requests a password reset code to be sent to the admin email.
   * On success → switches UI to "reset" mode.
   */
  const sendCode = async () => {
    setMsg("");
    const res = await fetch(`${ADMIN_API}/security/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    setMode("reset");
    setMsg("📧 Reset code sent to email");
  };

  /**
   * Sends the received reset code and new password to backend.
   * On success → returns user to login mode.
   */
  const resetPassword = async () => {
    setMsg("");
    const res = await fetch(`${ADMIN_API}/security/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, newPassword: password }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    setMode("login");
    setMsg("✅ Password updated successfully");
  };

  /**
   * UI Rendering:
   * The displayed inputs and buttons depend on the current mode.
   */
  return (
    <div className="space-y-4">

      {/* Title */}
      <div className="text-lg font-bold text-blue-700">
        Admin Login
      </div>

      {/* Email Input (always visible) */}
      <input
        type="email"
        placeholder="Email"
        className="w-full border rounded-xl px-4 py-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* Password Input (Login and Reset modes) */}
      {(mode === "login" || mode === "reset") && (
        <input
          type="password"
          placeholder={mode === "login" ? "Password" : "New Password"}
          className="w-full border rounded-xl px-4 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}

      {/* Reset Code Input (Reset mode only) */}
      {mode === "reset" && (
        <input
          placeholder="Reset code from email"
          className="w-full border rounded-xl px-4 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}

      {/* Status / Error Message */}
      {msg && <div className="text-sm text-red-600">{msg}</div>}

      {/* Login Mode Buttons */}
      {mode === "login" && (
        <>
          <button
            className="w-full bg-blue-600 text-white rounded-xl py-2"
            onClick={login}
          >
            Login
          </button>

          <button
            className="text-xs underline"
            onClick={() => setMode("forgot")}
          >
            Forgot password?
          </button>
        </>
      )}

      {/* Forgot Password Mode Buttons **/}
      {mode === "forgot" && (
        <>
          <button
            className="w-full bg-gray-600 text-white rounded-xl py-2"
            onClick={sendCode}
          >
            Send reset code
          </button>

          <button
            className="text-xs underline"
            onClick={() => setMode("login")}
          >
            Back to login
          </button>
        </>
      )}

      {/* Reset Mode Button */}
      {mode === "reset" && (
        <button
          className="w-full bg-green-600 text-white rounded-xl py-2"
          onClick={resetPassword}
        >
          Update password
        </button>
      )}
    </div>
  );
}