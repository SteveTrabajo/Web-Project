import { Lightbulb, LightbulbOff } from "lucide-react";
import { useTheme } from "../theme/ThemeProvider.jsx";

/*
 * variant="floating" - fixed bottom-left puck, desktop only. On phones it landed
 *   on top of the chat's send button, so it is hidden below lg.
 * variant="inline"   - compact button for the mobile navbar, which is where the
 *   toggle lives on small screens.
 */
export default function ThemeToggle({ variant = "floating" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const base =
    "flex items-center justify-center rounded-full transition-all duration-200";

  const styles =
    variant === "inline"
      ? "w-11 h-11 rounded-xl text-white/80 border border-white/10 bg-white/5 hover:text-white hover:bg-white/10 hover:border-white/20"
      : "hidden lg:flex fixed bottom-4 left-4 z-50 w-11 h-11 border border-border bg-card text-foreground shadow-lg hover:scale-105 hover:text-bio-green";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "מצב בהיר" : "מצב כהה"}
      className={`${base} ${styles}`}
    >
      {isDark
        ? <LightbulbOff className="w-5 h-5" />
        : <Lightbulb className="w-5 h-5 text-amber-400" />}
    </button>
  );
}
