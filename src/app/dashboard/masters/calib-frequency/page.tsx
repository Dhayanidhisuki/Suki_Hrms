"use client";

import { useEffect, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";

const COLUMNS = [
  { key: "prodToleranceMin", label: "Tol Min", mono: true },
  { key: "prodToleranceMax", label: "Tol Max", mono: true },
  { key: "calibFrequency", label: "Frequency (months)", mono: true }
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
      const res = await apiGet<{ items?: Row[] }>("/api/lookups/calib-frequency");
      if (!cancelled) {
        setItems(res.data?.items ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <SimpleMasterShell title="Calibration Frequency Master" subtitle="CALIBRATION_FREQUENCY_MASTER — frequency by product tolerance">
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
                  <tr key={String(row["id"] ?? idx)} className="hover:bg-[var(--bg-hover)]">
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
    </SimpleMasterShell>
  );
}
