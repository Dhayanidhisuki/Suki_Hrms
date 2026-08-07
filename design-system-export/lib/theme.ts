export type ThemeName = "blue" | "green" | "purple" | "orange";
export type ThemeMode = "light" | "dark";

export const validThemes: readonly ThemeName[] = ["blue", "green", "purple", "orange"];
export const validModes: readonly ThemeMode[] = ["light", "dark"];

export const DEFAULT_THEME_NAME: ThemeName = "blue";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

export function migrateTheme(val?: string | null): ThemeName {
  if (val && validThemes.includes(val as ThemeName)) {
    return val as ThemeName;
  }
  return DEFAULT_THEME_NAME;
}

export function migrateMode(val?: string | null): ThemeMode {
  if (val && validModes.includes(val as ThemeMode)) {
    return val as ThemeMode;
  }
  return DEFAULT_THEME_MODE;
}
