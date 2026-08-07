"use client";

import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type QuickActionItem = {
  id: string;
  href: string;
  label: string;
  sublabel: string;
  variant: "primary" | "secondary" | "ghost";
  icon: ReactNode;
};

type ActionButtonProps = {
  id: string;
  icon: ReactNode;
  label: string;
  sublabel: string;
  variant: "primary" | "secondary" | "ghost";
  onClick?: () => void;
};

function ActionButton({ id, icon, label, sublabel, variant, onClick }: ActionButtonProps) {
  const styles = {
    primary:
      "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white border border-[var(--primary-hover)] shadow-sm hover:shadow-md",
    secondary:
      "bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-main)] hover:border-[var(--border-strong)] shadow-sm hover:shadow-md",
    ghost:
      "bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-dashed border-[var(--border-main)] hover:border-[var(--border-strong)]",
  };

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-150 group cursor-pointer ${styles[variant]}`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          variant === "primary"
            ? "bg-white/20 group-hover:bg-white/30"
            : variant === "secondary"
              ? "bg-[var(--primary-light)] group-hover:bg-[var(--primary-subtle)]"
              : "bg-[var(--bg-surface)] group-hover:bg-[var(--primary-light)]"
        }`}
      >
        <span
          className={
            variant === "primary"
              ? "text-white"
              : variant === "secondary"
                ? "text-[var(--primary)]"
                : "text-[var(--text-muted)] group-hover:text-[var(--primary)]"
          }
        >
          {icon}
        </span>
      </div>
      <div className="text-left min-w-0">
        <p
          className={`text-sm font-semibold leading-tight ${
            variant === "primary" ? "text-white" : "text-[var(--text-primary)]"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-[11px] leading-tight mt-0.5 ${
            variant === "primary" ? "text-white/80" : "text-[var(--text-muted)]"
          }`}
        >
          {sublabel}
        </p>
      </div>
      <ArrowUpRight
        className={`w-4 h-4 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 ${
          variant === "primary" ? "text-white/80" : "text-[var(--text-muted)]"
        }`}
      />
    </button>
  );
}

export type QuickActionsProps = {
  title?: string;
  subtitle?: string;
  footerNote?: string;
  /** Host app supplies routes + icons — no hardcoded Tools Management links. */
  actions: QuickActionItem[];
};

/** Prop-driven quick-action card. Pass `actions` from the host app. */
export default function QuickActions({
  title = "Quick Actions",
  subtitle = "Common tasks",
  footerNote,
  actions,
}: QuickActionsProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        {actions.map((a) => (
          <Link key={a.id} href={a.href} className="block w-full">
            <ActionButton
              id={a.id}
              icon={a.icon}
              label={a.label}
              sublabel={a.sublabel}
              variant={a.variant}
            />
          </Link>
        ))}
      </div>

      {footerNote ? (
        <div className="mt-4 pt-3 border-t border-[var(--border-main)]">
          <p className="text-[11px] text-[var(--text-muted)] text-center leading-relaxed">{footerNote}</p>
        </div>
      ) : null}
    </div>
  );
}

export type { LucideIcon };
