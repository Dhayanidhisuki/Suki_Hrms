import { ThemeName, ThemeMode, migrateTheme, migrateMode } from "./theme";

export const THEME_COOKIE_NAME = "suki-theme";
export const MODE_COOKIE_NAME = "suki-mode";
export const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export interface ThemeCookies {
  theme: ThemeName;
  mode: ThemeMode;
}

export function parseCookieString(cookieHeader: string | null | undefined): ThemeCookies {
  if (!cookieHeader) {
    return { theme: migrateTheme(null), mode: migrateMode(null) };
  }

  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((c) => {
    const parts = c.trim().split("=");
    if (parts.length >= 2) {
      cookies[parts[0]] = parts.slice(1).join("=");
    }
  });

  return {
    theme: migrateTheme(cookies[THEME_COOKIE_NAME]),
    mode: migrateMode(cookies[MODE_COOKIE_NAME]),
  };
}

export function readThemeCookies(): ThemeCookies {
  if (typeof document === "undefined") {
    return { theme: migrateTheme(null), mode: migrateMode(null) };
  }
  return parseCookieString(document.cookie);
}

export function writeThemeCookies(theme: ThemeName, mode: ThemeMode) {
  if (typeof document === "undefined") return;

  const expires = new Date(Date.now() + ONE_YEAR_SECONDS * 1000).toUTCString();
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; Expires=${expires}; SameSite=Lax`;
  document.cookie = `${MODE_COOKIE_NAME}=${mode}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; Expires=${expires}; SameSite=Lax`;
}
