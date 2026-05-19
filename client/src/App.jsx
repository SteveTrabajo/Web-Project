

import { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ChatBot from "./components/Bot";
import LabsViewer from "./components/LabsViewer";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [view, setView] = useState("home");

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar view={view} onNavigate={setView} />

      {view === "home" && <Hero onStart={() => setView("chat")} />}

      {view !== "home" && (
        <main className="bg-linear-to-b from-blue-50 to-white dark:from-slate-950 dark:to-slate-900 min-h-screen">
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


