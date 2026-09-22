"use client";

/** ERP-style page number window: 1 … 4 5 [6] 7 8 … 28 */
export function pageWindow(current: number, totalPages: number, radius = 2): (number | "…")[] {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function TablePager({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
  idPrefix = "pager",
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const nums = pageWindow(page, totalPages);

  return (
    <div className="mt-4 pt-3 border-t border-[var(--border-main)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <span className="text-xs text-[var(--text-muted)]">
        Showing{" "}
        <span className="font-semibold text-[var(--text-primary)]">
          {from}–{to}
        </span>{" "}
        out of{" "}
        <span className="font-semibold text-[var(--text-primary)]">{total.toLocaleString()}</span>
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            id={`${idPrefix}-first`}
            disabled={page <= 1 || disabled}
            onClick={() => onPageChange(1)}
            className="px-2 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            title="First page"
          >
            «
          </button>
          <button
            type="button"
            id={`${idPrefix}-prev`}
            disabled={page <= 1 || disabled}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹ Prev
          </button>

          {nums.map((n, idx) =>
            n === "…" ? (
              <span key={`e-${idx}`} className="px-1.5 text-xs text-[var(--text-muted)]">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                id={`${idPrefix}-page-${n}`}
                disabled={disabled}
                onClick={() => onPageChange(n)}
                className={`min-w-[2rem] px-2 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  n === page
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                {n}
              </button>
            )
          )}

          <button
            type="button"
            id={`${idPrefix}-next`}
            disabled={page >= totalPages || disabled}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next ›
          </button>
          <button
            type="button"
            id={`${idPrefix}-last`}
            disabled={page >= totalPages || disabled}
            onClick={() => onPageChange(totalPages)}
            className="px-2 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Last page"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
