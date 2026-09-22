"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export type OverlayModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer actions (Cancel / Save) — sticky at bottom of modal */
  footer?: ReactNode;
  /** Max width class, default max-w-4xl */
  size?: "md" | "lg" | "xl" | "5xl";
  /** Optional header right slot (e.g. + Add new) */
  headerAction?: ReactNode;
  /** Stack above another overlay (ERP satellite dialogs) */
  layer?: "base" | "nested";
};

const SIZE: Record<NonNullable<OverlayModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "5xl": "max-w-5xl",
};

/**
 * Centered overlay dialog. Keep the underlying page mounted;
 * sync the URL in the parent (e.g. ?action=add) so the route changes
 * without navigating to a separate full page.
 */
export function OverlayModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "xl",
  headerAction,
  layer = "base",
}: OverlayModalProps) {
  const zClass = layer === "nested" ? "z-[70]" : "z-[60]";
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center p-4 sm:p-6`}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-modal-title"
        className={`relative w-full ${SIZE[size]} max-h-[min(92vh,900px)] flex flex-col bg-[var(--bg-card)] rounded-2xl shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)] animate-fade-in overflow-hidden`}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4">
          <div className="min-w-0">
            <h2
              id="overlay-modal-title"
              className="text-xl font-bold text-[var(--text-primary)] tracking-tight"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 pb-2">{children}</div>

        {footer ? (
          <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-[var(--border-main)] bg-[var(--bg-subtle)]/80">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
