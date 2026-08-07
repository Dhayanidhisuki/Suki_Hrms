import { useState, useEffect } from "react";
import { THEMES } from "./themes";
import { ThemeName } from "./theme";
import { readThemeCookies } from "./theme-cookies";

export function useThemeAccent() {
  const [accent, setAccent] = useState<string>(() => {
    const { theme } = readThemeCookies();
    return THEMES[theme]?.dot || THEMES.blue.dot;
  });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeName; mode: string }>;
      if (customEvent.detail?.theme && THEMES[customEvent.detail.theme]) {
        setAccent(THEMES[customEvent.detail.theme].dot);
      }
    };

    window.addEventListener("suki-theme-change", handleThemeChange);
    return () => {
      window.removeEventListener("suki-theme-change", handleThemeChange);
    };
  }, []);

  return accent;
}
