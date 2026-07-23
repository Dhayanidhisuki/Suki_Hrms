"use client";

import {
  Package,
  ArrowUpRight,
  CalendarClock,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";

interface KpiData {
  totalTools: number;
  currentlyIssued: number;
  calibrationDue: number;
  underRepairOrCal: number;
}

interface KpiCardProps {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  trend?: { value: string; positive: boolean };
  suffix?: string;
}

function KpiCard({
  id,
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  suffix,
}: KpiCardProps) {
  return (
    <div
      id={id}
      className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 hover:shadow-md transition-shadow duration-200"
    >
      {/* Icon bubble */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-900 leading-none tabular-nums">
            {value.toLocaleString()}
          </span>
          {suffix && (
            <span className="text-sm text-slate-400 mb-0.5">{suffix}</span>
          )}
        </div>
        {trend && (
          <p
            className={`text-xs font-medium mt-1.5 flex items-center gap-0.5 ${
              trend.positive ? "text-emerald-600" : "text-red-500"
            }`}
          >
            <ArrowUpRight
              className={`w-3 h-3 ${!trend.positive ? "rotate-180" : ""}`}
            />
            {trend.value}
          </p>
        )}
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
      if (res.data) setStats(res.data);
      setLoading(false);
    });
  }, []);

  const cards: KpiCardProps[] = [
    {
      id: "kpi-total-tools",
      label: "Total Tools",
      value: loading ? 0 : stats.totalTools,
      icon: Package,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      trend: { value: "+4 this month", positive: true },
    },
    {
      id: "kpi-currently-issued",
      label: "Currently Issued",
      value: loading ? 0 : stats.currentlyIssued,
      icon: ArrowUpRight,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      trend: { value: "3 overdue", positive: false },
    },
    {
      id: "kpi-calibration-due",
      label: "Calibration Due",
      value: loading ? 0 : stats.calibrationDue,
      icon: CalendarClock,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      suffix: "this month",
      trend: { value: "2 this week", positive: false },
    },
    {
      id: "kpi-under-repair",
      label: "Under Repair / Cal.",
      value: loading ? 0 : stats.underRepairOrCal,
      icon: Wrench,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      trend: { value: "1 new today", positive: false },
    },
  ];

  return (
    <div
      className={`grid grid-cols-4 gap-4 mb-6 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
    >
      {cards.map((card) => (
        <KpiCard key={card.id} {...card} />
      ))}
    </div>
  );
}
