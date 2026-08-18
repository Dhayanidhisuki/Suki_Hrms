"use client";

import {
  Package,
  ArrowUpRight,
  CalendarClock,
  Wrench,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";

import { AnimatedCountUp } from "@/components/ui/AnimatedCountUp";

interface KpiData {
  totalTools: number;
  currentlyIssued: number;
  calibrationDue: number;
  underRepairOrCal: number;
  trends?: {
    addedThisMonth: number;
    overdueCount: number;
    calibrationThisWeek: number;
  };
}

interface KpiCardProps {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  accentFrom: string;
  accentTo: string;
  trend: { value: string; positive: boolean };
}

function KpiCard({
  id,
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  accentFrom,
  accentTo,
  trend,
}: KpiCardProps) {
  const TrendIcon = trend.positive ? TrendingUp : TrendingDown;

  return (
    <div
      id={id}
      className="bg-[var(--bg-card)] rounded-[12px] border-[0.5px] border-[var(--border-main)] p-5 h-full min-h-[148px] flex flex-col hover:shadow-md transition-all duration-200 overflow-hidden relative"
    >
      <div className="flex items-start justify-between gap-3 relative z-[1]">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider leading-4 line-clamp-2 min-h-8 pr-1">
            {label}
          </p>

          <div className="mt-3">
            <span className="text-3xl font-medium text-[var(--text-primary)] leading-none tabular-nums tracking-tight h-9 inline-flex items-center">
              <AnimatedCountUp value={value ?? 0} />
            </span>
          </div>
        </div>

        {/* Decorative flat illustration — soft stack behind icon */}
        <div className="relative w-14 h-14 shrink-0" aria-hidden>
          <span
            className="absolute inset-0 rounded-2xl opacity-90"
            style={{
              background: `linear-gradient(145deg, ${accentFrom}, ${accentTo})`,
            }}
          />
          <span className="absolute -right-1 -bottom-1 w-8 h-8 rounded-xl bg-[var(--bg-card)]/40 border-[0.5px] border-white/10" />
          <span className="absolute -left-1.5 top-1 w-5 h-5 rounded-full bg-white/10" />
          <span
            className={`absolute inset-0 m-auto w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}
          >
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-2.5 mt-auto border-t-[0.5px] border-[var(--border-main)] min-h-[34px] relative z-[1]">
        <span
          className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold border-[0.5px] ${
            trend.positive
              ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--border-main)]"
              : "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--border-main)]"
          }`}
        >
          <TrendIcon className="w-3 h-3" />
          {trend.value}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] truncate min-w-0 flex-1">
          vs last month
        </span>
      </div>
    </div>
  );
}

export default function KpiRow() {
  const [stats, setStats] = useState<KpiData>({
    totalTools: 0,
    currentlyIssued: 0,
    calibrationDue: 0,
    underRepairOrCal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<KpiData>("/api/dashboard/kpi").then((res) => {
      if (res.data) {
        const data = res.data;
        setStats((prev) => ({
          ...prev,
          ...data,
          trends: {
            addedThisMonth: 0,
            overdueCount: 0,
            calibrationThisWeek: 0,
            ...prev.trends,
            ...(data.trends ?? {}),
          },
        }));
      }
      setLoading(false);
    });
  }, []);

  const added = stats.trends?.addedThisMonth ?? 0;
  const overdue = stats.trends?.overdueCount ?? 0;
  const calThisWeek = stats.trends?.calibrationThisWeek ?? 0;

  const cards: KpiCardProps[] = [
    {
      id: "kpi-total-tools",
      label: "Total Tools",
      value: loading ? 0 : stats.totalTools,
      icon: Package,
      iconBg: "bg-[var(--primary-light)]",
      iconColor: "text-[var(--primary)]",
      accentFrom: "color-mix(in srgb, var(--primary) 35%, transparent)",
      accentTo: "color-mix(in srgb, var(--primary) 10%, transparent)",
      trend: {
        value: `+${added} new`,
        positive: true,
      },
    },
    {
      id: "kpi-currently-issued",
      label: "Currently Issued",
      value: loading ? 0 : stats.currentlyIssued,
      icon: ArrowUpRight,
      iconBg: "bg-[var(--color-info-bg)]",
      iconColor: "text-[var(--color-info-text)]",
      accentFrom: "color-mix(in srgb, #38bdf8 35%, transparent)",
      accentTo: "color-mix(in srgb, #38bdf8 10%, transparent)",
      trend: {
        value: `${overdue} overdue`,
        positive: overdue === 0,
      },
    },
    {
      id: "kpi-calibration-due",
      label: "Calibration Due",
      value: loading ? 0 : stats.calibrationDue,
      icon: CalendarClock,
      iconBg: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      accentFrom: "color-mix(in srgb, #f59e0b 35%, transparent)",
      accentTo: "color-mix(in srgb, #f59e0b 10%, transparent)",
      trend: {
        value: `${calThisWeek} this week`,
        positive: calThisWeek === 0,
      },
    },
    {
      id: "kpi-under-repair",
      label: "Under Repair / Cal.",
      value: loading ? 0 : stats.underRepairOrCal,
      icon: Wrench,
      iconBg: "bg-rose-50 dark:bg-rose-950/30",
      iconColor: "text-rose-600 dark:text-rose-400",
      accentFrom: "color-mix(in srgb, #f43f5e 35%, transparent)",
      accentTo: "color-mix(in srgb, #f43f5e 10%, transparent)",
      trend: {
        value: `${stats.underRepairOrCal > 0 ? "Active service" : "Optimal"}`,
        positive: stats.underRepairOrCal === 0,
      },
    },
  ];

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-stretch transition-opacity ${
        loading ? "opacity-50" : "opacity-100"
      }`}
    >
      {cards.map((card) => (
        <KpiCard key={card.id} {...card} />
      ))}
    </div>
  );
}
