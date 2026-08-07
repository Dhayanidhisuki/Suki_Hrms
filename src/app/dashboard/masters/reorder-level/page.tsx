"use client";

import { useEffect, useMemo, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StockBatteryMeter } from "@/components/OverviewCharts";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { apiGet } from "@/lib/apiClient";

type Row = {
  id?: number | string;
  toolOrGaugeNo?: string;
  name?: string;
  grouping?: string;
  qtyIn?: number | string;
  reorderLevel?: number | string;
  totQty?: number | string;
  uom?: string;
  status?: string;
};

const toNum = (v: unknown, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function Page() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items?: Row[] }>("/api/reorder-level");
      if (!cancelled) {
        setItems(res.data?.items ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        String(row.toolOrGaugeNo ?? "").toLowerCase().includes(q) ||
        String(row.name ?? "").toLowerCase().includes(q) ||
        String(row.grouping ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <SimpleMasterShell title="Reorder Level Monitoring" subtitle="Visual battery stock gauges and reorder threshold metrics">
      <MasterTableCard
        toolbar={
          <MasterSearchInput
            id="reorder-level-search"
            value={query}
            onChange={setQuery}
            placeholder="Search tool, group…"
            widthClass="w-52"
          />
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
                  <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                    Tool No / Name
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                    Group
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 w-72">
                    Visual Stock Battery Gauge (Qty vs ROL)
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {filtered.map((row, idx) => {
                  const curr = toNum(row.qtyIn);
                  const rol = toNum(row.reorderLevel, 5);
                  const tot = toNum(row.totQty, 50);

                  return (
                    <tr key={String(row.id ?? idx)} className="hover:bg-[var(--bg-hover)]">
                      <td className="py-3.5 px-3">
                        <p className="font-mono text-xs font-bold text-[var(--text-primary)]">{row.toolOrGaugeNo || "TOOL-REG"}</p>
                        <p className="text-xs text-[var(--text-muted)]">{row.name || "Precision Tool"}</p>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">{row.grouping || "General Tooling"}</td>
                      <td className="py-3.5 px-3">
                        <StockBatteryMeter currQty={curr} rolQty={rol} totQty={tot} />
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200">
                          {row.status || "ACTIVE"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-[var(--text-muted)]">No reorder items found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>
    </SimpleMasterShell>
  );
}
