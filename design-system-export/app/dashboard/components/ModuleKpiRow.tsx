"use client";

import { LucideIcon } from "lucide-react";
import { AnimatedCountUp } from "@/components/ui/AnimatedCountUp";

export interface ModuleKpiItem {
  id: string;
  label: string;
  value: number | string;
  subtext?: string;
  /** Native browser tooltip — clarifies filter when counts can coincide */
  title?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  badge?: { label: string; type: "success" | "warning" | "info" | "neutral" };
}

function badgeClasses(type: NonNullable<ModuleKpiItem["badge"]>["type"]) {
  if (type === "success") {
    return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200";
  }
  if (type === "warning") {
    return "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200";
  }
  if (type === "info") {
    return "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200";
  }
  return "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-main)]";
}

export function ModuleKpiRow({
  items,
  variant = "default",
  columns = 4,
  className = "",
}: {
  items: ModuleKpiItem[];
  /** simple = label + number only, equal 4-col grid (History Card) */
  variant?: "default" | "simple";
  /** Grid columns — use 2 for chart-beside KPI panels */
  columns?: 2 | 4;
  className?: string;
}) {
  if (variant === "simple") {
    return (
      <div
        className={`grid grid-cols-2 ${columns === 4 ? "lg:grid-cols-4" : ""} gap-3 mb-6 ${className}`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            title={item.title ?? item.subtext}
            className="bg-[var(--bg-card)] rounded-[12px] border-[0.5px] border-[var(--border-main)] p-4 min-h-[88px] flex flex-col justify-center"
          >
            <p className="text-[12px] font-medium text-[var(--text-muted)] leading-tight">
              {item.label}
            </p>
            <p className="mt-1.5 text-[22px] font-medium leading-none tabular-nums tracking-tight text-[var(--text-primary)]">
              <AnimatedCountUp value={item.value} />
            </p>
          </div>
        ))}
      </div>
    );
  }

  const gridCols =
    columns === 2
      ? "grid-cols-2 gap-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <div className={`grid ${gridCols} mb-6 items-stretch ${className}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            title={item.title}
            className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 h-full min-h-[148px] flex flex-col hover:shadow-sm hover:border-[var(--primary)]/30 transition-all duration-200 shadow-xs"
          >
            {/* Top: fixed label band + icon so values line up across cards */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider leading-4 line-clamp-2 min-h-8 pr-1">
                {item.label}
              </p>
              {Icon && (
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg ?? "bg-[var(--bg-subtle)]"}`}
                >
                  <Icon className={`w-5 h-5 ${item.iconColor ?? "text-[var(--primary)]"}`} />
                </div>
              )}
            </div>

            {/* Value: fixed height so footers align */}
            <div className="mt-3 flex-1 flex items-start">
              <span className="text-2xl lg:text-3xl font-medium text-[var(--text-primary)] leading-none tabular-nums tracking-tight h-9 flex items-center">
                <AnimatedCountUp value={item.value} />
              </span>
            </div>

            {/* Footer: always reserved so all cards share the same bottom edge */}
            <div className="flex items-center gap-1.5 pt-2.5 mt-auto border-t border-[var(--border-main)] min-h-[34px]">
              {item.badge ? (
                <span
                  className={`inline-flex items-center shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClasses(item.badge.type)}`}
                >
                  {item.badge.label}
                </span>
              ) : null}
              {item.subtext ? (
                <span
                  className="text-[11px] text-[var(--text-muted)] font-medium truncate min-w-0 flex-1"
                  title={item.subtext}
                >
                  {item.subtext}
                </span>
              ) : (
                <span className="text-[11px] invisible select-none">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
