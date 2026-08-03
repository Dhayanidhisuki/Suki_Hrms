"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
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
}: HistoryCardListViewProps) {
  const searchParams = useSearchParams();
  const toolFromUrl = (searchParams.get("tool") ?? "").trim();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (toolFromUrl) setQuery(toolFromUrl);
  }, [toolFromUrl]);

  const displayRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
    return rows.filter((row) =>
      keys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [rows, query, searchKeys, columns]);

  return (
    <HistoryCardShell
      title={title}
      subtitle={subtitle}
      kpis={kpis}
      toolbar={
        <HistoryCardSearch
          value={query}
          onChange={setQuery}
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
