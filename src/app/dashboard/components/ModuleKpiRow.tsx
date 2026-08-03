"use client";

import { LucideIcon } from "lucide-react";
import { AnimatedCountUp } from "@/components/ui/AnimatedCountUp";

export interface ModuleKpiItem {
  id: string;
  label: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  badge?: { label: string; type: "success" | "warning" | "info" | "neutral" };
}

export function ModuleKpiRow({ items }: { items: ModuleKpiItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 flex flex-col justify-between hover:shadow-sm hover:border-[var(--primary)]/30 transition-all duration-200 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  {item.label}
                </p>
                <span className="text-2xl lg:text-3xl font-medium text-[var(--text-primary)] leading-none tabular-nums mt-2 block tracking-tight">
                  <AnimatedCountUp value={item.value} />
                </span>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                <Icon className={`w-5 h-5 ${item.iconColor}`} />
              </div>
            </div>

            {item.subtext && (
              <div className="flex items-center gap-1.5 pt-2.5 border-t border-[var(--border-main)]">
                {item.badge && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.badge.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200"
                        : item.badge.type === "warning"
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200"
                        : item.badge.type === "info"
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200"
                        : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]"
                    }`}
                  >
                    {item.badge.label}
                  </span>
                )}
                <span className="text-[11px] text-[var(--text-muted)] font-medium truncate">{item.subtext}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
