"use client";

/** Shared Recharts bar entrance animation */
export const BAR_ANIMATION = {
  isAnimationActive: true,
  animationBegin: 0,
  animationDuration: 750,
  animationEasing: "ease-out" as const,
};

export const BAR_ANIMATION_STAGGER = {
  ...BAR_ANIMATION,
  animationBegin: 80,
};

const VERTICAL_HEIGHTS = [42, 78, 55, 92, 64, 86, 48, 70] as const;
const HORIZONTAL_WIDTHS = [78, 52, 90, 38, 66, 48] as const;

type SkeletonProps = {
  color?: string;
  horizontal?: boolean;
  /** Number of placeholder bars */
  bars?: number;
  className?: string;
};

/** Pulsing placeholder bars shown while chart data loads */
export function BarChartLoadingSkeleton({
  color = "var(--primary)",
  horizontal = false,
  bars,
  className = "",
}: SkeletonProps) {
  if (horizontal) {
    const widths = HORIZONTAL_WIDTHS.slice(0, bars ?? HORIZONTAL_WIDTHS.length);
    return (
      <div
        className={`h-full w-full flex flex-col justify-center gap-3 py-3 pr-2 ${className}`}
        role="status"
        aria-label="Loading chart"
      >
        {widths.map((w, i) => (
          <div key={i} className="flex items-center gap-3 min-h-[18px]">
            <div
              className="h-2.5 w-[88px] shrink-0 rounded-full bg-[var(--bg-subtle)] animate-pulse"
              style={{ animationDelay: `${i * 70}ms` }}
            />
            <div
              className="bar-chart-skeleton-bar-h h-[14px] rounded-r-full rounded-l-sm"
              style={{
                width: `${w}%`,
                backgroundColor: color,
                animationDelay: `${i * 90}ms`,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  const heights = VERTICAL_HEIGHTS.slice(0, bars ?? VERTICAL_HEIGHTS.length);
  return (
    <div
      className={`h-full w-full flex flex-col px-2 pt-2 pb-1 ${className}`}
      role="status"
      aria-label="Loading chart"
    >
      <div className="relative flex-1 min-h-0 flex items-end gap-[3.5%] px-[6%] pl-[40px] pb-1">
        <div
          className="absolute left-[40px] right-[2%] bottom-0 h-px"
          style={{ backgroundColor: "var(--border-main)" }}
        />
        {heights.map((h, i) => (
          <div key={i} className="flex-1 h-full flex items-end justify-center">
            <div
              className="bar-chart-skeleton-bar w-[55%] max-w-[26px] rounded-t-[10px] rounded-b-[2px]"
              style={{
                height: `${h}%`,
                backgroundColor: color,
                animationDelay: `${i * 85}ms`,
                transformOrigin: "bottom center",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between px-[8%] pl-[48px] pt-3">
        {Array.from({ length: Math.min(6, heights.length) }).map((_, i) => (
          <div
            key={i}
            className="h-2 w-7 rounded-full bg-[var(--bg-subtle)] animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
