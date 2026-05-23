import { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ChatBot from "./components/Bot";
import LabsViewer from "./components/LabsViewer";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [view, setView] = useState("home");

  return (
    <div className="min-h-screen bg-surface-page text-content-primary">
      <Navbar view={view} onNavigate={setView} />

      {view === "home" && <Hero onStart={() => setView("chat")} />}

      {view !== "home" && (
        <main className="min-h-screen bg-surface-page">
          <div className="max-w-6xl mx-auto px-4 py-8">
            {view === "chat" && <ChatBot />}
            {view === "labs" && <LabsViewer />}
            {view === "admin" && <AdminPanel />}
          </div>
        </main>
      )}
    </div>
  );
}
