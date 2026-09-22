"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

/** Compact single-line search used inside MasterTableCard toolbars (Asset Master pattern). */
export function MasterSearchInput({
  id,
  value,
  onChange,
  placeholder = "Search",
  widthClass = "w-44",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tailwind width class for the input shell */
  widthClass?: string;
}) {
  return (
    <div className={`relative shrink-0 ${widthClass}`}>
      <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-7 text-[11px] border border-[var(--border-main)] rounded-md pl-8 pr-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
      />
    </div>
  );
}

/**
 * Asset Master–style list card: compact one-line toolbar + table body + optional footer.
 * Pair with StatusPillTabs above the card when the list has status facets.
 */
export function MasterTableCard({
  toolbar,
  children,
  footer,
  error,
  className = "",
}: {
  toolbar: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  error?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm relative animate-fade-in flex flex-col ${className}`}
    >
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium border-b border-[var(--border-main)] rounded-t-xl">
          {error}
        </div>
      )}
      <div className="px-3 py-2 border-b border-[var(--border-main)] flex items-center gap-2 flex-wrap sm:flex-nowrap relative z-30 min-w-0">
        {toolbar}
      </div>
      <div className="overflow-x-auto rounded-b-xl relative z-10">
        {children}
      </div>
      {footer ? (
        <div className="px-3 py-2.5 border-t border-[var(--border-main)] bg-[var(--bg-subtle)]/40 rounded-b-xl">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
