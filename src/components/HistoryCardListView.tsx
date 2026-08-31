"use client";

import { ReactNode, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  HistoryCardShell,
  HistoryCardSearch,
  HistoryCardPanel,
  fmtCell,
} from "@/components/HistoryCardShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ModuleKpiItem } from "@/app/dashboard/components/ModuleKpiRow";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type HistoryColumn = {
  key: string;
  label: string;
  mono?: boolean;
  status?: boolean;
  render?: (row: Record<string, unknown>) => ReactNode;
};

interface HistoryCardListViewProps {
  title: string;
  subtitle: string;
  kpis?: ModuleKpiItem[];
  columns: HistoryColumn[];
  rows: Record<string, unknown>[];
  loading: boolean;
  searchKeys?: string[];
  searchPlaceholder?: string;
  emptyText?: string;
  rowKey?: (row: Record<string, unknown>, idx: number) => string;
  filterHint?: string;
  /** Optional header actions (e.g. cross-links to GRN / PO-linked Receive) */
  actions?: ReactNode;
}

export function HistoryCardListView({
  title,
  subtitle,
  kpis,
  columns,
  rows,
  loading,
  searchKeys = [],
  searchPlaceholder = "Filter rows…",
  emptyText = "No records found.",
  rowKey,
  filterHint,
  actions,
}: HistoryCardListViewProps) {
  const searchParams = useSearchParams();
  const toolFromUrl = (searchParams.get("tool") ?? "").trim();
  const [editedQuery, setEditedQuery] = useState<string | null>(null);
  const query = editedQuery ?? toolFromUrl;

  const displayRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
    return rows.filter((row) =>
      keys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [rows, query, searchKeys, columns]);

  const chartData = useMemo(() => {
    const preferred = columns.find((column) => column.status)?.key;
    const fallback = columns.find((column) =>
      ["grouping", "type", "vendorType", "supplier", "holder"].includes(column.key)
    )?.key;
    const key = preferred ?? fallback ?? columns[0]?.key;
    if (!key) return { key: "Records", values: [] as Array<{ name: string; value: number }> };

    const counts = new Map<string, number>();
    for (const row of displayRows) {
      const raw = String(row[key] ?? "Not specified").trim() || "Not specified";
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    const values = [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return {
      key: columns.find((column) => column.key === key)?.label ?? key,
      values,
    };
  }, [columns, displayRows]);

  return (
    <HistoryCardShell
      title={title}
      subtitle={subtitle}
      kpis={kpis}
      actions={actions}
      toolbar={
        <HistoryCardSearch
          value={query}
          onChange={setEditedQuery}
          placeholder={searchPlaceholder}
          hint={
            filterHint ||
            (toolFromUrl
              ? `Opened from History Card for ${toolFromUrl}. Edit search to widen results.`
              : undefined)
          }
        />
      }
    >
      <HistoryCardPanel
        title={`${chartData.key} Overview`}
        subtitle={`Live distribution for the ${displayRows.length.toLocaleString()} visible record${displayRows.length === 1 ? "" : "s"}`}
        className="mb-5"
      >
        {loading ? (
          <div className="h-56 animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
        ) : chartData.values.length > 0 ? (
          <div className="h-64 w-full" aria-label={`${title} ${chartData.key} chart`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.values} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border-main)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border-main)" }}
                  tickLine={false}
                  interval={0}
                  angle={chartData.values.length > 5 ? -18 : 0}
                  textAnchor={chartData.values.length > 5 ? "end" : "middle"}
                  height={chartData.values.length > 5 ? 54 : 32}
                />
                <YAxis
                  allowDecimals={false}
                  width={36}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--bg-hover)" }}
                  contentStyle={{
                    border: "1px solid var(--border-main)",
                    borderRadius: 10,
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [Number(value).toLocaleString(), "Records"]}
                />
                <Bar dataKey="value" name="Records" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--text-muted)]">
            No chart data available.
          </div>
        )}
      </HistoryCardPanel>

      <HistoryCardPanel
        title={title}
        subtitle={`${displayRows.length.toLocaleString()} row${displayRows.length === 1 ? "" : "s"}`}
      >
        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="overflow-auto -mx-1">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {displayRows.map((row, idx) => (
                  <tr
                    key={rowKey?.(row, idx) ?? String(idx)}
                    className="hover:bg-[var(--bg-hover)]"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-3 px-3 text-xs text-[var(--text-secondary)] ${
                          col.mono ? "font-mono" : ""
                        }`}
                      >
                        {col.render
                          ? col.render(row)
                          : col.status
                            ? <StatusBadge status={row[col.key]} />
                            : fmtCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {displayRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-10 text-center text-sm text-[var(--text-muted)]"
                    >
                      {emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </HistoryCardPanel>
    </HistoryCardShell>
  );
}
