"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { History, CalendarClock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { apiGet } from "@/lib/apiClient";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { MasterTableCard } from "@/components/ui/MasterTableCard";

interface Tool {
  refNo: number | null;
  toolOrGaugeNo: string;
  name: string | null;
  grouping: string | null;
  type?: string | null;
  frequency?: string | null;
  cDate?: string | null;
  nextCalibrationDate: string | null;
  status: string | null;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CalibrationDueListPage() {
  const [filter, setFilter] = useState<"All" | "Overdue" | "Due in 7 Days" | "Due in 30 Days">(
    "All"
  );
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTools = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: Tool[]; alertDays: number }>("/api/tools/calibration-due");
    if (res.data?.items) setTools(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const rows = tools
    .map((t) => ({ ...t, daysLeft: daysUntil(t.nextCalibrationDate) }))
    .filter((t) => t.daysLeft !== null)
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  const filtered = rows.filter((t) => {
    if (filter === "All") return true;
    if (filter === "Overdue") return (t.daysLeft ?? 0) < 0;
    if (filter === "Due in 7 Days") return (t.daysLeft ?? 0) >= 0 && (t.daysLeft ?? 0) <= 7;
    if (filter === "Due in 30 Days") return (t.daysLeft ?? 0) >= 0 && (t.daysLeft ?? 0) <= 30;
    return true;
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Calibration Due List
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Tools/gauges due or overdue for calibration (issue line NXT_CALIB_DATE / CALIB_DUE_DATE)
              </p>
            </div>
            <Link
              href="/dashboard/calibration/calendar"
              className="text-xs font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
            >
              Open year calendar →
            </Link>
          </div>

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "total-due",
                label: "Total Due Tools",
                value: tools.length,
                subtext: "Within alert window",
                icon: History,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Due", type: "info" },
              },
              {
                id: "overdue-count",
                label: "Currently Overdue",
                value: tools.filter((t) => {
                  const d = daysUntil(t.nextCalibrationDate);
                  return d !== null && d < 0;
                }).length,
                subtext: "Past calibration date",
                icon: ShieldAlert,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Overdue", type: "warning" },
              },
              {
                id: "due-7-days",
                label: "Due in 7 Days",
                value: tools.filter((t) => {
                  const d = daysUntil(t.nextCalibrationDate);
                  return d !== null && d >= 0 && d <= 7;
                }).length,
                subtext: "Immediate attention required",
                icon: CalendarClock,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "7 Days", type: "info" },
              },
              {
                id: "due-30-days",
                label: "Due in 30 Days",
                value: tools.filter((t) => {
                  const d = daysUntil(t.nextCalibrationDate);
                  return d !== null && d >= 0 && d <= 30;
                }).length,
                subtext: "Upcoming this month",
                icon: CheckCircle2,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "30 Days", type: "success" },
              },
            ]}
          />

          <StatusPillTabs
            className="mb-3"
            idPrefix="due-list-filter"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "All", label: "All", count: rows.length },
              {
                value: "Overdue",
                label: "Overdue",
                count: rows.filter((t) => (t.daysLeft ?? 0) < 0).length,
              },
              {
                value: "Due in 7 Days",
                label: "Due in 7 Days",
                count: rows.filter((t) => (t.daysLeft ?? 0) >= 0 && (t.daysLeft ?? 0) <= 7).length,
              },
              {
                value: "Due in 30 Days",
                label: "Due in 30 Days",
                count: rows.filter((t) => (t.daysLeft ?? 0) >= 0 && (t.daysLeft ?? 0) <= 30).length,
              },
            ]}
          />

          <MasterTableCard
            toolbar={<span className="text-[11px] text-[var(--text-muted)]">Calibration due tools</span>}
            footer={
              <span className="text-xs text-[var(--text-muted)]">
                Showing {filtered.length} of {rows.length} tools due for calibration
              </span>
            }
          >
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={5} />
              </div>
            ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {["Tool No", "Name", "Grouping", "Type", "Freq", "Last Calib", "Status", "Next Due", "Days Left", ""].map(
                      (col) => (
                        <th
                          key={col || "action"}
                          className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:pr-0"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {filtered.map((t) => {
                    const overdue = (t.daysLeft ?? 0) < 0;
                    return (
                      <tr key={t.refNo ?? t.toolOrGaugeNo} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{t.toolOrGaugeNo}</td>
                        <td className="py-3 px-3 font-medium text-[var(--text-primary)]">{t.name}</td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{t.grouping ?? "—"}</td>
                        <td className="py-3 px-3 text-[var(--text-secondary)]">{t.type ?? "—"}</td>
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)]">{t.frequency ? `${t.frequency} mo` : "—"}</td>
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)]">
                          {t.cDate ? t.cDate.split("T")[0] : "—"}
                        </td>
                        <td className="py-3 px-3"><StatusBadge status={t.status} /></td>
                        <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)]">
                          {t.nextCalibrationDate ? t.nextCalibrationDate.split("T")[0] : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              overdue
                                ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
                                : (t.daysLeft ?? 99) <= 7
                                ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--border-main)]"
                                : "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                            }`}
                          >
                            {overdue && <AlertTriangle className="w-3 h-3" />}
                            {overdue
                              ? `${Math.abs(t.daysLeft ?? 0)}d overdue`
                              : `${t.daysLeft}d left`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/dashboard/calibration/issue?tool=${encodeURIComponent(t.toolOrGaugeNo)}`}
                            className="text-xs font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
                          >
                            Issue now
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-sm text-[var(--text-muted)]">
                        No tools match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </MasterTableCard>
        </main>
      </div>
    </div>
  );
}
