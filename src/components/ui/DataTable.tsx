'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: ReactNode;
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
  /** Extra filter controls rendered inline to the right of the search box. */
  filters?: ReactNode;
  /**
   * Put `filters` on the left and let the search box sit hard right, instead
   * of the default search-first order. Matches the masters layout where the
   * status pills are the primary control and search is secondary.
   */
  filtersLead?: boolean;
  onPageChange?: (page: number) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Extra per-row action(s) rendered before Edit/Delete in the Actions cell. */
  renderRowActions?: (row: T) => ReactNode;
  /**
   * React key per row. Defaults to row.id, which is unique within a single
   * table — but not across a merged dataset, where two modules can both
   * carry id 9. Was declared but never read until now, so any caller passing
   * it was silently ignored.
   */
  rowKey?: (row: T) => string | number;
  emptyMessage?: string;
  /**
   * `default` — the original look (plain search input, bordered table,
   * "N records · Prev / Next" footer), used everywhere.
   * `card` — the redesigned look (single card with a search+filters toolbar,
   * numbered centred pagination), opted into by redesigned pages only.
   */
  variant?: 'default' | 'card';
}

/** Builds the page-number strip: 1 2 3 4 5 … (with ellipsis) around the current page. */
function pageItems(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: Array<number | '…'> = [];
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  if (start > 1) {
    items.push(1);
    if (start > 2) items.push('…');
  }
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total) {
    if (end < total - 1) items.push('…');
    items.push(total);
  }
  return items;
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const Chevron = ({ dir, double }: { dir: 'left' | 'right'; double?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {double ? (
      <>
        <path d={dir === 'left' ? 'm11 17-5-5 5-5' : 'm13 17 5-5-5-5'} />
        <path d={dir === 'left' ? 'm18 17-5-5 5-5' : 'm6 17 5-5-5-5'} />
      </>
    ) : (
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    )}
  </svg>
);


/**
 * One row action, as an icon.
 *
 * `title` plus `aria-label` on purpose: the glyph alone is the whole control,
 * so the hover tooltip is what a sighted user reads and the label is what a
 * screen reader announces. Delete stays neutral until hover — a row of red
 * buttons reads as a table full of errors.
 */
export function RowAction({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors ${
        tone === 'danger'
          ? 'hover:border-[var(--color-danger)]/30 hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]'
          : 'hover:border-[var(--primary)]/30 hover:bg-[var(--primary-light)] hover:text-[var(--primary)]'
      }`}
    >
      {children}
    </button>
  );
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  pagination,
  loading,
  searchValue,
  searchPlaceholder = 'Search...',
  onSearchChange,
  filters,
  filtersLead = false,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  rowKey,
  renderRowActions,
  emptyMessage = 'No records found.',
  variant = 'default',
}: DataTableProps<T>) {
  const card = variant === 'card';
  const hasActions = Boolean(onView || onEdit || onDelete || renderRowActions);
  const colSpan = columns.length + (hasActions ? 1 : 0);

  const table = (
    <table className="min-w-full text-sm">
      <thead>
        <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`px-4 py-3 text-left text-xs font-semibold ${col.className ?? ''}`}
              style={{ color: 'var(--text-secondary)' }}
            >
              {col.label}
            </th>
          ))}
          {hasActions && (
            <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Actions
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={colSpan} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
              Loading...
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={colSpan} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row) => (
            <tr
              key={rowKey ? rowKey(row) : row.id}
              className="transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderTop: '1px solid var(--border-main)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-[13px] ${col.className ?? ''}`} style={{ color: 'var(--text-primary)' }}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </td>
              ))}
              {/* Narrower padding than a data cell: three icons plus the
                  default px-4 made the actions column wide enough to push a
                  table into horizontal scroll on its own. */}
              {hasActions && (
                <td className="w-px whitespace-nowrap px-2 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-0.5">
                    {renderRowActions && (
                      <span className="inline-flex items-center">{renderRowActions(row)}</span>
                    )}
                    {onView && (
                      <RowAction label="View" onClick={() => onView(row)}>
                        <Eye className="h-3.5 w-3.5" />
                      </RowAction>
                    )}
                    {onEdit && (
                      <RowAction label="Edit" onClick={() => onEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </RowAction>
                    )}
                    {onDelete && (
                      <RowAction label="Delete" tone="danger" onClick={() => onDelete(row)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </RowAction>
                    )}
                  </span>
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  /* ── Default (original) layout ─────────────────────────────────────── */
  if (!card) {
    return (
      <div className="space-y-3">
        {(onSearchChange || filters) && (
          <div className="flex flex-wrap items-center gap-2">
            {filtersLead && filters}
            {onSearchChange && (
              <input
                type="text"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={`rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${filtersLead ? 'ml-auto w-full max-w-[320px]' : 'min-w-[200px] flex-1'}`}
                style={{
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)',
                }}
              />
            )}
            {!filtersLead && filters}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
          {table}
        </div>

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

  /* ── Card (redesigned) layout ──────────────────────────────────────── */
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
      {(onSearchChange || filters) && (
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          {filtersLead && filters}
          {onSearchChange && (
            <label
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm focus-within:ring-1 ${filtersLead ? 'ml-auto w-full max-w-[340px]' : 'min-w-[240px] flex-1'}`}
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}
            >
              <SearchIcon />
              <input
                type="text"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent focus:outline-none"
                style={{ color: 'var(--foreground)' }}
              />
            </label>
          )}
          {!filtersLead && filters}
        </div>
      )}

      <div className="overflow-x-auto">{table}</div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-center gap-1 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <PageButton disabled={pagination.page <= 1} onClick={() => onPageChange?.(1)} label="First page">
            <Chevron dir="left" double />
          </PageButton>
          <PageButton disabled={pagination.page <= 1} onClick={() => onPageChange?.(pagination.page - 1)} label="Previous page">
            <Chevron dir="left" />
          </PageButton>
          {pageItems(pagination.page, Math.max(1, pagination.totalPages)).map((item, i) =>
            item === '…' ? (
              <span key={`e${i}`} className="px-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                …
              </span>
            ) : (
              <PageButton key={item} active={item === pagination.page} onClick={() => onPageChange?.(item)} label={`Page ${item}`}>
                {item}
              </PageButton>
            ),
          )}
          <PageButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange?.(pagination.page + 1)} label="Next page">
            <Chevron dir="right" />
          </PageButton>
          <PageButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange?.(pagination.totalPages)} label="Last page">
            <Chevron dir="right" double />
          </PageButton>
        </div>
      )}
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--foreground)',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
