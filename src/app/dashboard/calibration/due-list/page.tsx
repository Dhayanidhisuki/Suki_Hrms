"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";

interface Tool {
  id: number;
  toolOrGaugeNo: string;
  name: string;
  location: string | null;
  caliPlannedWho: string | null;
  nextCalibrationDate: string | null;
  status: string;
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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Calibration Due List
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Tools/gauges due or overdue for calibration (GAUGEANDTOOLS)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 mb-4 w-fit">
              {(["All", "Overdue", "Due in 7 Days", "Due in 30 Days"] as const).map((f) => (
                <button
                  key={f}
                  id={`due-list-filter-${f.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filter === f
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="overflow-auto">
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Tool No", "Name", "Location", "Calibrated By", "Next Due", "Days Left"].map(
                      (col) => (
                        <th
                          key={col}
                          className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((t) => {
                    const overdue = (t.daysLeft ?? 0) < 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">{t.toolOrGaugeNo}</td>
                        <td className="py-3 pr-4 font-medium text-slate-800">{t.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{t.location ?? "—"}</td>
                        <td className="py-3 pr-4 text-slate-600">{t.caliPlannedWho ?? "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                          {t.nextCalibrationDate ? t.nextCalibrationDate.split("T")[0] : "—"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              overdue
                                ? "bg-red-50 text-red-700"
                                : (t.daysLeft ?? 99) <= 7
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {overdue && <AlertTriangle className="w-3 h-3" />}
                            {overdue
                              ? `${Math.abs(t.daysLeft ?? 0)}d overdue`
                              : `${t.daysLeft}d left`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                        No tools match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Showing {filtered.length} of {rows.length} tools due for calibration
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
