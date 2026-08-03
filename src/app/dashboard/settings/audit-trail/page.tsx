"use client";

import { useEffect, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ChartContainer, LogActivityHistogram } from "@/components/OverviewCharts";
import { apiGet } from "@/lib/apiClient";

const COLUMNS = [
  { key: "entity", label: "Table", mono: true },
  { key: "key", label: "Record", mono: true },
  { key: "label", label: "Label", mono: false },
  { key: "createdBy", label: "Created By", mono: false },
  { key: "createdAt", label: "Created", mono: true },
  { key: "updatedBy", label: "Updated By", mono: false },
  { key: "updatedAt", label: "Updated", mono: true }
] as const;

type Row = Record<string, unknown>;

function cell(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && v.includes("T") && !Number.isNaN(Date.parse(v))) return v.split("T")[0];
  return String(v);
}

export default function Page() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items?: Row[] }>("/api/settings/audit-trail");
      if (!cancelled) {
        setItems(res.data?.items ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <SimpleMasterShell title="Audit Trail" subtitle="System modification history, activity histogram, and row-level audit logs">
      <div className="space-y-6">
        {/* Graphical Representation: System Activity Histogram */}
        <ChartContainer
          title="System Modifications & Action Peak Volume"
          subtitle="Hourly histogram of data updates, creations, and deletion events"
        >
          <LogActivityHistogram />
        </ChartContainer>

        {/* Audit Log Table */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {items.map((row, idx) => (
                    <tr key={String(row["key"] ?? idx)} className="hover:bg-[var(--bg-hover)]">
                      {COLUMNS.map((col) => (
                        <td key={col.key} className={`py-3 px-3 text-[var(--text-secondary)] ${col.mono ? "font-mono text-xs" : ""}`}>
                          {cell(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="py-8 text-center text-sm text-[var(--text-muted)]">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SimpleMasterShell>
  );
}
