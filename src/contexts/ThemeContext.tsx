"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ThemeName, ThemeMode, DEFAULT_THEME_NAME, DEFAULT_THEME_MODE } from "@/lib/theme";
import { readThemeCookies } from "@/lib/theme-cookies";
import { applyTheme } from "@/lib/applyTheme";

export interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  pendingTheme: ThemeName | null;
  isConfirmOpen: boolean;
  requestThemeChange: (newTheme: ThemeName) => void;
  confirmThemeChange: () => void;
  cancelThemeChange: () => void;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  initialTheme,
  initialMode,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeName;
  initialMode?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme || DEFAULT_THEME_NAME);
  const [mode, setModeState] = useState<ThemeMode>(initialMode || DEFAULT_THEME_MODE);
  const [pendingTheme, setPendingTheme] = useState<ThemeName | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Sync state on mount
  useEffect(() => {
    const cookies = readThemeCookies();
    const activeTheme = initialTheme || cookies.theme;
    const activeMode = initialMode || cookies.mode;
    setThemeState(activeTheme);
    setModeState(activeMode);
    applyTheme(activeTheme, activeMode);
  }, [initialTheme, initialMode]);

  const requestThemeChange = useCallback(
    (newTheme: ThemeName) => {
      if (newTheme === theme) return;
      setPendingTheme(newTheme);
      setIsConfirmOpen(true);
    },
    [theme]
  );

  const confirmThemeChange = useCallback(() => {
    if (pendingTheme) {
      setThemeState(pendingTheme);
      applyTheme(pendingTheme, mode);
    }
    setPendingTheme(null);
    setIsConfirmOpen(false);
  }, [pendingTheme, mode]);

  const cancelThemeChange = useCallback(() => {
    setPendingTheme(null);
    setIsConfirmOpen(false);
  }, []);

  const toggleMode = useCallback(() => {
    const nextMode: ThemeMode = mode === "light" ? "dark" : "light";
    setModeState(nextMode);
    applyTheme(theme, nextMode);
  }, [mode, theme]);

  const setMode = useCallback(
    (newMode: ThemeMode) => {
      if (newMode === mode) return;
      setModeState(newMode);
      applyTheme(theme, newMode);
    },
    [mode, theme]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        pendingTheme,
        isConfirmOpen,
        requestThemeChange,
        confirmThemeChange,
        cancelThemeChange,
        toggleMode,
        setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
