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
    <div className={`flex items-center px-2.5 py-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-main)] shadow-xs ${className}`}>
      {/* 4 Color Dots for Theme Switch */}
      <div className="flex items-center gap-2 pr-2.5 border-r border-[var(--border-main)]">
        {(Object.keys(THEMES) as ThemeName[]).map((tKey) => {
          const t = THEMES[tKey];
          const isActive = theme === tKey;
          return (
            <button
              key={tKey}
              type="button"
              onClick={() => requestThemeChange(tKey)}
              title={t.label}
              className={`w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center cursor-pointer relative ${
                isActive
                  ? "ring-2 ring-offset-2 ring-[var(--primary)] ring-offset-[var(--bg-subtle)] scale-105 opacity-100 z-10"
                  : "hover:scale-110 opacity-70 hover:opacity-100"
              }`}
              style={{ backgroundColor: t.dot }}
              aria-label={`Switch to ${t.label} theme`}
            />
          );
        })}
      </div>

      {/* Sun / Moon Mode Toggle */}
      <button
        type="button"
        onClick={toggleMode}
        title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="pl-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center"
        aria-label="Toggle light/dark mode"
      >
        {mode === "dark" ? (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        )}
      </button>

      {/* Confirmation Modal */}
      <ThemeConfirmDialog />
    </div>
  );
}
