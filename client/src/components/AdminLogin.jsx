import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const ADMIN_API = `${API_BASE}/api/admin`;

export default function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

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
    setIsSuccess(true);
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
    setIsSuccess(true);
    setMsg("Password updated successfully");
  };

  const inputClass =
    "w-full border border-surface-border bg-surface-page text-content-primary rounded-xl px-4 py-3 text-sm outline-none " +
    "focus:ring-2 focus:ring-brand-navy dark:focus:ring-bio-green-glow transition-colors placeholder:text-content-muted";

  const titles = {
    login: "Admin Login",
    forgot: "Reset Password",
    reset: "Set New Password",
  };

  const subtitles = {
    login: "Sign in to manage BIO-BOT content",
    forgot: "Enter your email to receive a reset code",
    reset: "Enter the code from your email and choose a new password",
  };

  return (
    <div className="space-y-5" dir="ltr">

      {/* Header */}
      <div className="flex flex-col items-center gap-2 pb-1">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-navy dark:bg-surface-raised shadow-md">
          <span className="text-xl font-extrabold text-brand-gold">B</span>
        </div>
        <div>
          <h2 className="text-center text-lg font-extrabold text-brand-navy dark:text-bio-green-glow tracking-tight">
            {titles[mode]}
          </h2>
          <p className="text-center text-xs text-content-muted mt-0.5">{subtitles[mode]}</p>
        </div>
      </div>

      <hr className="border-surface-border" />

      {/* Fields */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-content-muted uppercase tracking-wide">
            Email
          </label>
          <input
            type="email"
            placeholder="admin@example.com"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {(mode === "login" || mode === "reset") && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-content-muted uppercase tracking-wide">
              {mode === "login" ? "Password" : "New Password"}
            </label>
            <input
              type="password"
              placeholder={mode === "login" ? "••••••••" : "Choose a new password"}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {mode === "reset" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-content-muted uppercase tracking-wide">
              Reset Code
            </label>
            <input
              placeholder="Paste code from email"
              className={inputClass}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Feedback */}
      {msg && (
        <div
          className={`text-xs rounded-xl px-3 py-2.5 border ${
            isSuccess
              ? "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20"
              : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}
        >
          {msg}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {mode === "login" && (
          <>
            <button
              className="w-full bg-brand-navy dark:bg-bio-green-glow dark:text-brand-navy-deep text-white text-sm font-semibold rounded-xl py-2.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
              onClick={login}
            >
              Sign In
            </button>
            <div className="text-center">
              <button
                className="text-xs text-content-muted hover:text-content-primary underline underline-offset-2 transition-colors"
                onClick={() => { setMode("forgot"); setMsg(""); setIsSuccess(false); }}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}

        {mode === "forgot" && (
          <>
            <button
              className="w-full bg-brand-navy dark:bg-bio-green-glow dark:text-brand-navy-deep text-white text-sm font-semibold rounded-xl py-2.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
              onClick={sendCode}
            >
              Send Reset Code
            </button>
            <div className="text-center">
              <button
                className="text-xs text-content-muted hover:text-content-primary underline underline-offset-2 transition-colors"
                onClick={() => { setMode("login"); setMsg(""); setIsSuccess(false); }}
              >
                Back to login
              </button>
            </div>
          </>
        )}

        {mode === "reset" && (
          <>
            <button
              className="w-full bg-bio-green dark:bg-bio-green-glow dark:text-brand-navy-deep text-white text-sm font-semibold rounded-xl py-2.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
              onClick={resetPassword}
            >
              Update Password
            </button>
            <div className="text-center">
              <button
                className="text-xs text-content-muted hover:text-content-primary underline underline-offset-2 transition-colors"
                onClick={() => { setMode("login"); setMsg(""); setIsSuccess(false); }}
              >
                Back to login
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-[10px] text-content-muted pt-1">
        BIO-BOT 2.0 &mdash; Admin Portal
      </p>
    </div>
  );
}
