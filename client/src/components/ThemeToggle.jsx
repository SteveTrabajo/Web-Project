import { Lightbulb, LightbulbOff } from "lucide-react";
import { useTheme } from "../theme/ThemeProvider.jsx";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "מצב בהיר" : "מצב כהה"}
      className="fixed bottom-4 left-4 z-50 flex items-center justify-center w-11 h-11 rounded-full border border-border bg-card text-foreground shadow-lg hover:scale-105 hover:text-bio-green transition-all duration-200"
    >
      {isDark
        ? <LightbulbOff className="w-5 h-5" />
        : <Lightbulb className="w-5 h-5 text-amber-400" />}
    </button>
  );
}
