import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const ADMIN_API = `${API_BASE}/api/admin`;

export default function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState("");

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

  const sendCode = async () => {
    setMsg("");
    const res = await fetch(`${ADMIN_API}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    setMode("reset");
    setMsg("Reset code sent to email");
  };

  const resetPassword = async () => {
    setMsg("");
    const res = await fetch(`${ADMIN_API}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, newPassword: password }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    setMode("login");
    setMsg("Password updated successfully");
  };

  const inputClass = "w-full border border-surface-border bg-surface-page text-content-primary rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-brand-navy transition-colors placeholder:text-content-muted";

  return (
    <div className="space-y-4">
      <div className="text-lg font-bold text-brand-navy dark:text-bio-green-glow">
        Admin Login
      </div>

      <input
        type="email"
        placeholder="Email"
        className={inputClass}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {(mode === "login" || mode === "reset") && (
        <input
          type="password"
          placeholder={mode === "login" ? "Password" : "New Password"}
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}

      {mode === "reset" && (
        <input
          placeholder="Reset code from email"
          className={inputClass}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}

      {msg && <div className="text-sm text-red-600 dark:text-red-400">{msg}</div>}

      {mode === "login" && (
        <>
          <button
            className="w-full bg-brand-navy text-white rounded-xl py-2 hover:opacity-90 transition-opacity"
            onClick={login}
          >
            Login
          </button>
          <button
            className="text-xs underline text-content-muted hover:text-content-primary transition-colors"
            onClick={() => setMode("forgot")}
          >
            Forgot password?
          </button>
        </>
      )}

      {mode === "forgot" && (
        <>
          <button
            className="w-full bg-surface-raised text-content-primary border border-surface-border rounded-xl py-2 hover:bg-surface-border transition-colors"
            onClick={sendCode}
          >
            Send reset code
          </button>
          <button
            className="text-xs underline text-content-muted hover:text-content-primary transition-colors"
            onClick={() => setMode("login")}
          >
            Back to login
          </button>
        </>
      )}

      {mode === "reset" && (
        <button
          className="w-full bg-bio-green text-white rounded-xl py-2 hover:opacity-90 transition-opacity"
          onClick={resetPassword}
        >
          Update password
        </button>
      )}
    </div>
  );
}
