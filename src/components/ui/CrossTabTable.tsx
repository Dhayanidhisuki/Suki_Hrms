"use client";

/**
 * Financial-year cross-tab: a frozen label column, one column per FY month,
 * and a totals row.
 *
 * The label column is sticky rather than in a separate table, so the two
 * halves cannot drift out of vertical alignment when the month columns scroll.
 */

export interface CrossTabRow {
  label: string;
  values: number[];
}

export function CrossTabTable({
  columns,
  rows,
  formatValue = (n) => (n === 0 ? '0' : n.toLocaleString('en-IN')),
  labelHeader = 'Department',
  totalLabel = 'Total',
  emptyMessage = 'No records found.',
}: {
  columns: string[];
  rows: CrossTabRow[];
  formatValue?: (n: number) => string;
  labelHeader?: string;
  totalLabel?: string;
  emptyMessage?: string;
}) {
  // Column totals only. The legacy screen has no per-row total across the 12
  // months, and adding one would change what the grid means.
  const totals = columns.map((_, i) => rows.reduce((sum, r) => sum + (r.values[i] ?? 0), 0));
  const hasRows = rows.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--bg-subtle)]">
            <th className="sticky left-0 z-10 min-w-[170px] border-b border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {labelHeader}
            </th>
            {columns.map((c) => (
              <th
                key={c}
                className="min-w-[74px] border-b border-[var(--border-main)] px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-main)]">
          {!hasRows && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="py-10 text-center text-sm text-[var(--text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.label} className="transition-colors hover:bg-[var(--bg-hover)]">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-[var(--bg-card)] px-3 py-2.5 text-left text-xs font-medium text-[var(--text-primary)]"
              >
                {r.label}
              </th>
              {columns.map((_, i) => {
                const v = r.values[i] ?? 0;
                return (
                  <td
                    key={i}
                    className="px-3 py-2.5 text-right text-xs tabular-nums"
                    // A zero is real data, but it is not what the reader is
                    // scanning for — muted so the populated months stand out.
                    style={{ color: v === 0 ? 'var(--text-subtle)' : 'var(--text-secondary)' }}
                  >
                    {formatValue(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {hasRows && (
          <tfoot>
            <tr className="bg-[var(--primary)] text-white">
              <th className="sticky left-0 z-10 bg-[var(--primary)] px-3 py-2.5 text-left text-xs font-bold">
                {totalLabel}
              </th>
              {totals.map((t, i) => (
                <td key={i} className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                  {formatValue(t)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
