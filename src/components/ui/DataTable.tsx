'use client';

import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pagination?: Pagination;
  loading?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onPageChange?: (page: number) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Extra per-row action(s) rendered before Edit/Delete in the Actions cell. */
  renderRowActions?: (row: T) => ReactNode;
  rowKey?: (row: T) => string | number;
  emptyMessage?: string;
  /** 'simple' (default, unchanged) = Prev / Page X of Y / Next. 'numbered' = « ‹ 1 2 3 … › » page-number bar. Opt-in per page. */
  paginationVariant?: 'simple' | 'numbered';
}

/** Page numbers to render for the 'numbered' pagination variant, with `null` standing in for an ellipsis gap. Always shows first, last, current, and one neighbor on each side. */
function buildPageList(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push(null);
    result.push(sorted[i]);
  }
  return result;
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  pagination,
  loading,
  searchValue,
  searchPlaceholder = 'Search...',
  onSearchChange,
  onPageChange,
  onEdit,
  onDelete,
  renderRowActions,
  emptyMessage = 'No records found.',
  paginationVariant = 'simple',
}: DataTableProps<T>) {
  return (
    <div className="space-y-3">
      {/* Search bar */}
      {onSearchChange && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--foreground)',
              borderColor: 'var(--border)',
            }}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <table className="min-w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-medium ${col.className ?? ''}`}
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete || renderRowActions) && (
                <th className="px-4 py-3 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{ borderTop: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`} style={{ color: 'var(--foreground)' }}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                  {(onEdit || onDelete || renderRowActions) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {renderRowActions && (
                        <span className="mr-3 inline-flex items-center">{renderRowActions(row)}</span>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="text-xs font-medium mr-3 hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="text-xs font-medium hover:underline text-red-500"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && paginationVariant === 'simple' && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            {pagination.total} record{pagination.total !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Prev
            </button>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && paginationVariant === 'numbered' && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            {pagination.total} record{pagination.total !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            {[
              { label: '«', page: 1, aria: 'First page' },
              { label: '‹', page: pagination.page - 1, aria: 'Previous page' },
            ].map((b) => (
              <button
                key={b.aria}
                onClick={() => onPageChange?.(b.page)}
                disabled={pagination.page <= 1}
                aria-label={b.aria}
                className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {b.label}
              </button>
            ))}
            {buildPageList(pagination.page, pagination.totalPages).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="px-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  aria-current={p === pagination.page ? 'page' : undefined}
                  className="rounded px-2.5 py-1 text-xs font-medium"
                  style={
                    p === pagination.page
                      ? { backgroundColor: 'var(--accent)', color: 'white' }
                      : { border: '1px solid var(--border)', color: 'var(--foreground)' }
                  }
                >
                  {p}
                </button>
              )
            )}
            {[
              { label: '›', page: pagination.page + 1, aria: 'Next page' },
              { label: '»', page: pagination.totalPages, aria: 'Last page' },
            ].map((b) => (
              <button
                key={b.aria}
                onClick={() => onPageChange?.(b.page)}
                disabled={pagination.page >= pagination.totalPages}
                aria-label={b.aria}
                className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
