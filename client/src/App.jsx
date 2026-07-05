import { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ChatBot from "./components/Bot";
import LabsViewer from "./components/LabsViewer";
import AdminPanel from "./components/AdminPanel";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  const [view, setView] = useState("home");
  const [admin, setAdmin] = useState(() =>
    JSON.parse(sessionStorage.getItem("bio_admin") || "null")
  );

  const handleLogout = () => {
    setAdmin(null);
    sessionStorage.removeItem("bio_admin");
  };

  // Home and chat are sized to fit exactly within the viewport (no page scroll)
  const fitToScreen = view === "home" || view === "chat";

  return (
    <div
      className={`bg-surface-page text-content-primary flex flex-col ${
        fitToScreen ? "h-dvh overflow-hidden" : "min-h-dvh"
      }`}
    >
      <Navbar
        view={view}
        onNavigate={setView}
        admin={admin}
        onLogout={handleLogout}
      />

      {view === "home" && <Hero onStart={() => setView("chat")} />}

      {view === "chat" && (
        <main className="flex-1 min-h-0 bg-surface-page">
          <div className="h-full max-w-7xl mx-auto px-2 py-2 sm:px-4 sm:py-4">
            <ChatBot />
          </div>
        </main>
      )}

      {(view === "labs" || view === "admin") && (
        <main className="flex-1 bg-surface-page">
          <div className="max-w-7xl mx-auto px-4 py-8">
            {view === "labs" && <LabsViewer />}
            {view === "admin" && <AdminPanel admin={admin} setAdmin={setAdmin} />}
          </div>
        </main>
      )}

      <ThemeToggle />
    </div>
  );
}
