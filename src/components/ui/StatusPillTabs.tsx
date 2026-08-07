"use client";

export type StatusPillItem<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

type StatusPillTabsProps<T extends string = string> = {
  items: StatusPillItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  idPrefix?: string;
  /** Compact single-line pills (default sm for dense toolbars). */
  size?: "sm" | "md";
};

/**
 * Order-dashboard style status pills: blue filled when active, soft gray when idle,
 * numeric count badge on each chip.
 */
export function StatusPillTabs<T extends string = string>({
  items,
  value,
  onChange,
  className = "",
  idPrefix = "status-pill",
  size = "sm",
}: StatusPillTabsProps<T>) {
  const compact = size === "sm";

  return (
    <div
      role="tablist"
      className={`flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5 scrollbar-thin ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        const count =
          typeof item.count === "number" && Number.isFinite(item.count)
            ? item.count
            : null;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            id={`${idPrefix}-${item.value}`}
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center shrink-0 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
              compact ? "h-7 gap-1.5 px-2.5 text-[11px]" : "h-9 gap-2 px-3.5 text-sm font-semibold"
            } ${
              active
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border border-transparent"
            }`}
          >
            <span>{item.label}</span>
            {count != null && (
              <span
                className={`inline-flex items-center justify-center rounded-full font-bold tabular-nums ${
                  compact ? "min-w-[1.15rem] h-4 px-1 text-[10px]" : "min-w-[1.5rem] h-5 px-1.5 text-[11px]"
                } ${
                  active
                    ? "bg-white/25 text-white"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-main)]"
                }`}
              >
                {count > 999 ? `${Math.floor(count / 1000)}k+` : count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
