import { useTheme } from "../theme/ThemeProvider.jsx";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-lg px-3 py-1.5 text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
