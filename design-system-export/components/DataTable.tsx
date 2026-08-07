"use client";

import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Prefer mono for codes / amounts */
  mono?: boolean;
  className?: string;
  headerClassName?: string;
  cell: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  rowKey: (row: T) => string | number;
  emptyText?: string;
  /** When set, shows a leading chevron column and expands that row */
  expandedKey?: string | number | null;
  onToggleExpand?: (row: T) => void;
  renderExpanded?: (row: T) => ReactNode;
  skeletonRows?: number;
  minWidthClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  loading = false,
  rowKey,
  emptyText = "No records found.",
  expandedKey = null,
  onToggleExpand,
  renderExpanded,
  skeletonRows = 6,
  minWidthClassName = "min-w-[720px]",
}: DataTableProps<T>) {
  const expandable = Boolean(onToggleExpand && renderExpanded);
  const colSpan = columns.length + (expandable ? 1 : 0);

  if (loading) {
    return <TableSkeleton rows={skeletonRows} />;
  }

  return (
    <div className="overflow-auto -mx-1">
      <table className={`w-full text-sm ${minWidthClassName}`}>
        <thead>
          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
            {expandable && (
              <th className="w-10 py-2.5 px-2" aria-label="Expand" />
            )}
            {columns.map((col) => (
              <th
                key={col.id}
                className={`text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-main)]">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="py-10 text-center text-sm text-[var(--text-muted)]"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const isExpanded = expandable && expandedKey === key;
              return (
                <Fragment key={String(key)}>
                  <tr
                    className={`hover:bg-[var(--bg-hover)] ${
                      isExpanded ? "bg-[var(--bg-subtle)]/60" : ""
                    }`}
                  >
                    {expandable && (
                      <td className="py-2.5 px-2 align-middle">
                        <button
                          type="button"
                          onClick={() => onToggleExpand?.(row)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={`py-3 px-3 text-xs text-[var(--text-secondary)] align-middle ${
                          col.mono ? "font-mono" : ""
                        } ${col.className ?? ""}`}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpanded && (
                    <tr className="bg-[var(--bg-subtle)]/40">
                      <td colSpan={colSpan} className="px-3 pb-4 pt-0">
                        <div className="ml-2 mt-1 border border-[var(--border-main)] rounded-xl bg-[var(--bg-card)] overflow-hidden">
                          {renderExpanded(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
