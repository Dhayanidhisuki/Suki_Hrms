"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";
import Link from "next/link";
import { CalendarClock, ArrowRight } from "lucide-react";

interface CalItem {
  refNo: number | null;
  toolOrGaugeNo: string;
  name: string | null;
  nextCalibrationDate: string | null;
  status: string | null;
  grouping: string | null;
}

export default function RecentCalibrationTable() {
  const [items, setItems] = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ items: CalItem[] }>("/api/tools/calibration-due").then((res) => {
      if (res.data?.items) {
        setItems(res.data.items);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-bg)] flex items-center justify-center text-[var(--color-warning-text)]">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Upcoming Calibrations
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Tools nearing calibration due date
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/calibration/due-list"
            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className={`overflow-auto transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Tool No
                </th>
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Name
                </th>
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Due Date
                </th>
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {items.map((t) => {
                const dueDate = t.nextCalibrationDate ? t.nextCalibrationDate.split("T")[0] : "—";
                const isOverdue = t.nextCalibrationDate ? new Date(t.nextCalibrationDate) < new Date() : false;
                return (
                  <tr key={t.refNo ?? t.toolOrGaugeNo} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-3 px-3 align-middle font-mono text-xs font-semibold text-[var(--text-secondary)]">
                      {t.toolOrGaugeNo}
                    </td>
                    <td className="py-3 px-3 align-middle">
                      <p className="font-semibold text-[var(--text-primary)] text-xs truncate max-w-[140px]">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-medium">{t.grouping}</p>
                    </td>
                    <td className="py-3 px-3 align-middle font-mono text-xs">
                      <span className={isOverdue ? "text-[var(--color-danger-text)] font-bold" : "text-[var(--text-secondary)]"}>
                        {dueDate}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-middle">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isOverdue
                            ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
                            : "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--border-main)]"
                        }`}
                      >
                        {isOverdue ? "OVERDUE" : t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-[var(--text-muted)]">
                    No upcoming calibrations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
