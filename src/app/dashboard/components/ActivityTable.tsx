"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useSession } from "@/lib/SessionContext";

interface ActivityRecord {
  dcNo: string;
  /** Prefer party / receiver name from KPI payload */
  receiveName?: string | null;
  deptName?: string | null;
  partyName?: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: string;
}

export default function ActivityTable() {
  const { canModule } = useSession();
  const [items, setItems] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ recentActivity: ActivityRecord[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.recentActivity) {
        setItems(res.data.recentActivity);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Recent Issue / Receive Activity
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Latest tool slips from GaugeToolsIssue
              </p>
            </div>
          </div>
          {canModule("tool_issue_receive") && (
            <Link
              href="/dashboard/transactions/receive"
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className={`overflow-auto transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  DC No
                </th>
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Department / Party
                </th>
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Issue Date
                </th>
                <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase py-2.5 px-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {items.map((row, idx) => {
                const isOverdue = row.status === "OPEN" && row.dueDate ? new Date(row.dueDate) < new Date() : false;
                const party =
                  (row.partyName && row.partyName !== "-" ? row.partyName : null) ||
                  (row.receiveName && row.receiveName !== "-" ? row.receiveName : null);
                const dept = row.deptName && row.deptName !== "-" ? row.deptName : null;
                const primary = party || dept || "—";
                const dateStr = row.issueDate ? row.issueDate.split("T")[0] : "—";
                const rowKey = row.dcNo ? `${row.dcNo}-${idx}` : `activity-${idx}`;

                return (
                  <tr key={rowKey} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-3 px-3 align-middle font-mono text-xs font-semibold text-[var(--text-secondary)]">
                      {row.dcNo || "—"}
                    </td>
                    <td className="py-3 px-3 align-middle">
                      <p className="font-semibold text-[var(--text-primary)] text-xs truncate max-w-[150px]">
                        {primary}
                      </p>
                      {party && dept && (
                        <p className="text-[10px] text-[var(--text-muted)] font-medium">{dept}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 align-middle font-mono text-xs text-[var(--text-muted)]">
                      {dateStr}
                    </td>
                    <td className="py-3 px-3 align-middle">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isOverdue
                            ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
                            : row.status === "OPEN"
                            ? "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-main)]"
                            : "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                        }`}
                      >
                        {isOverdue ? "OVERDUE" : row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-[var(--text-muted)]">
                    No recent activity records found.
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
