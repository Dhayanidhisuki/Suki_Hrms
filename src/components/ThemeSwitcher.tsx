"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import { ThemeName } from "@/lib/theme";
import { ThemeConfirmDialog } from "./ThemeConfirmDialog";

export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const { theme, mode, requestThemeChange, toggleMode } = useTheme();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 4 Color Dots for Theme Switch */}
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-main)]">
        {(Object.keys(THEMES) as ThemeName[]).map((tKey) => {
          const t = THEMES[tKey];
          const isActive = theme === tKey;
          return (
            <button
              key={tKey}
              type="button"
              onClick={() => requestThemeChange(tKey)}
              title={t.label}
              className={`w-5 h-5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                isActive
                  ? "ring-2 ring-offset-1 ring-[var(--primary)] scale-110"
                  : "hover:scale-105 opacity-80 hover:opacity-100"
              }`}
              style={{ backgroundColor: t.dot }}
              aria-label={`Switch to ${t.label} theme`}
            />
          );
        })}
      </div>

      {/* Sun / Moon Instant Toggle Mode */}
      <button
        type="button"
        onClick={toggleMode}
        title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        aria-label="Toggle light/dark mode"
      >
        {mode === "dark" ? (
          <Sun className="w-4 h-4 text-[var(--color-warning)]" />
        ) : (
          <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
      </button>

      {/* Confirmation Modal */}
      <ThemeConfirmDialog />
    </div>
  );
}
