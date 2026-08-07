"use client";

import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";

export function ThemeConfirmDialog() {
  const { isConfirmOpen, pendingTheme, confirmThemeChange, cancelThemeChange } = useTheme();

  if (!isConfirmOpen || !pendingTheme) return null;

  const targetTheme = THEMES[pendingTheme];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl shadow-xl max-w-md w-full p-6 text-[var(--text-primary)] transition-all transform scale-100">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="w-4 h-4 rounded-full inline-block shrink-0"
            style={{ backgroundColor: targetTheme?.dot }}
          />
          <h3 className="text-lg font-semibold">Change Theme Accent</h3>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Are you sure you want to change the color theme to{" "}
          <strong style={{ color: targetTheme?.dot }}>{targetTheme?.label}</strong>?
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancelThemeChange}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-main)] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmThemeChange}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            style={{ backgroundColor: targetTheme?.dot }}
          >
            {targetTheme?.buttonText || "Apply Theme"}
          </button>
        </div>
      </div>
    </div>
  );
}
