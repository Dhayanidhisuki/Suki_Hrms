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
  rowKey?: (row: T) => string | number;
  emptyMessage?: string;
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
  emptyMessage = 'No records found.',
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
              {(onEdit || onDelete) && (
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
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
      {pagination && pagination.totalPages > 1 && (
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
    </div>
  );
}
