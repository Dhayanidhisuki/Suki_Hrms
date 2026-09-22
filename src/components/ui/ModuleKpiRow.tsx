"use client";

import { LucideIcon } from "lucide-react";
import { AnimatedCountUp } from "./AnimatedCountUp";
import KPICard, { type KPITone, type KPITrendDirection } from "./KPICard";

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
  badge?: { label: string; type: "success" | "warning" | "danger" | "info" | "neutral" };
}

function toneFromBadge(type: NonNullable<ModuleKpiItem["badge"]>["type"] | undefined): KPITone {
  if (type === "success" || type === "warning" || type === "danger" || type === "info") {
    return type;
  }
  return "info";
}

function trendDirection(type: NonNullable<ModuleKpiItem["badge"]>["type"]): KPITrendDirection {
  if (type === "danger") return "down";
  if (type === "warning") return "neutral";
  return "up";
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
      ? "grid-cols-2 gap-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <div className={`grid ${gridCols} mb-6 items-stretch ${className}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const tone = toneFromBadge(item.badge?.type);
        return (
          <KPICard
            key={item.id}
            label={item.label}
            value={item.value}
            title={item.title}
            tone={tone}
            icon={Icon ? <Icon /> : undefined}
            subtitle={item.badge ? undefined : item.subtext}
            trend={
              item.badge
                ? {
                    direction: trendDirection(item.badge.type),
                    value: item.badge.label,
                    label: item.subtext,
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
