import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
          <h2 className="text-center text-page-title text-brand-navy dark:text-bio-green-glow">
            {titles[mode]}
          </h2>
          <p className="text-center text-caption text-muted-foreground mt-0.5">{subtitles[mode]}</p>
        </div>
      </div>

      <Separator />

      {/* Fields */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-caption uppercase tracking-wide text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {(mode === "login" || mode === "reset") && (
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-caption uppercase tracking-wide text-muted-foreground">
              {mode === "login" ? "Password" : "New Password"}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === "login" ? "••••••••" : "Choose a new password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {mode === "reset" && (
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-caption uppercase tracking-wide text-muted-foreground">
              Reset Code
            </Label>
            <Input
              id="code"
              placeholder="Paste code from email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Feedback */}
      {msg && (
        <div
          className={`text-caption rounded-xl px-3 py-2.5 border ${
            isSuccess
              ? "text-bio-green dark:text-bio-green-glow bg-bio-green/10 border-bio-green/20"
              : "text-destructive bg-destructive/10 border-destructive/20"
          }`}
        >
          {msg}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {mode === "login" && (
          <>
            <Button className="w-full" onClick={login}>
              Sign In
            </Button>
            <div className="text-center">
              <Button
                variant="link"
                className="text-caption text-muted-foreground h-auto p-0"
                onClick={() => { setMode("forgot"); setMsg(""); setIsSuccess(false); }}
              >
                Forgot password?
              </Button>
            </div>
          </>
        )}

        {mode === "forgot" && (
          <>
            <Button className="w-full" onClick={sendCode}>
              Send Reset Code
            </Button>
            <div className="text-center">
              <Button
                variant="link"
                className="text-caption text-muted-foreground h-auto p-0"
                onClick={() => { setMode("login"); setMsg(""); setIsSuccess(false); }}
              >
                Back to login
              </Button>
            </div>
          </>
        )}

        {mode === "reset" && (
          <>
            <Button className="w-full bg-bio-green dark:bg-bio-green-glow dark:text-brand-navy-deep hover:opacity-90" onClick={resetPassword}>
              Update Password
            </Button>
            <div className="text-center">
              <Button
                variant="link"
                className="text-caption text-muted-foreground h-auto p-0"
                onClick={() => { setMode("login"); setMsg(""); setIsSuccess(false); }}
              >
                Back to login
              </Button>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-caption text-muted-foreground pt-1">
        BIO-BOT 2.0 - Admin Portal
      </p>
    </div>
  );
}
