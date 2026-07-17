import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "login") login();
    else if (mode === "forgot") sendCode();
    else if (mode === "reset") resetPassword();
  };

  const titles = {
    login: "Sign in",
    forgot: "Reset password",
    reset: "New password",
  };

  const subtitles = {
    login: "Manage BIO-BOT content",
    forgot: "We'll email you a reset code",
    reset: "Enter the code and choose a new password",
  };

  const submitLabel = {
    login: "Sign in",
    forgot: "Send reset code",
    reset: "Update password",
  };

  return (
    <form className="space-y-6" dir="ltr" onSubmit={handleSubmit}>

      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-page-title text-content-primary">{titles[mode]}</h2>
        <p className="text-caption text-muted-foreground">{subtitles[mode]}</p>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-caption text-muted-foreground">Email</Label>
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
            <Label htmlFor="password" className="text-caption text-muted-foreground">
              {mode === "login" ? "Password" : "New password"}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {mode === "reset" && (
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-caption text-muted-foreground">Reset code</Label>
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
          className={`text-caption rounded-lg px-3 py-2.5 ${
            isSuccess
              ? "text-bio-green dark:text-bio-green-glow bg-bio-green/10"
              : "text-destructive bg-destructive/10"
          }`}
        >
          {msg}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button type="submit" className="w-full">
          {submitLabel[mode]}
        </Button>
        <div className="text-center">
          <Button
            type="button"
            variant="link"
            className="text-caption text-muted-foreground h-auto p-0"
            onClick={() => {
              setMode(mode === "login" ? "forgot" : "login");
              setMsg("");
              setIsSuccess(false);
            }}
          >
            {mode === "login" ? "Forgot password?" : "Back to login"}
          </Button>
        </div>
      </div>
    </form>
  );
}
