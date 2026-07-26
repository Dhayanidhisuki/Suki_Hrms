import { ThemeName, ThemeMode } from "./theme";
import { writeThemeCookies } from "./theme-cookies";

export function applyTheme(theme: ThemeName, mode: ThemeMode) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Set data attributes
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-mode", mode);

  // Toggle .dark class for Tailwind and dark mode selectors
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Write cookies
  writeThemeCookies(theme, mode);

  // Dispatch custom event
  window.dispatchEvent(
    new CustomEvent("suki-theme-change", {
      detail: { theme, mode },
    })
  );
}
