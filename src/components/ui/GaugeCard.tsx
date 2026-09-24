'use client';

/**
 * Solid-tone ring gauge card — a real figure (balance, allowance) shown
 * against its ceiling, with an optional real "vs last year"-style delta.
 * Extracted from the ESS Leave page so every ESS request page with a real
 * balance to show (Leave, Comp-Off, Permission) renders it identically.
 */
export default function GaugeCard({
  label,
  value,
  max,
  deltaPct,
  deltaCaption = 'vs last year',
  tone,
}: {
  label: string;
  /** Remaining/available figure shown inside the ring. */
  value: number;
  /** Ceiling the ring is drawn against (entitlement, monthly allowance, …). */
  max: number;
  /** Real percentage change vs a prior period. Omit (null) when there is no
   * real prior-period figure to compare against — never fabricate one. */
  deltaPct: number | null;
  /** Caption after the delta, e.g. "vs last year" or "vs last month". */
  deltaCaption?: string;
  /** A CSS colour token, e.g. "var(--success)". */
  tone: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl p-5 text-white" style={{ backgroundColor: tone }}>
      <div className="min-w-0">
        <p className="text-xs font-medium opacity-80">Remaining</p>
        <p className="truncate text-2xl font-bold leading-tight">{label}</p>
        {deltaPct !== null && (
          <p className="mt-1.5 text-xs font-semibold" style={{ color: deltaPct >= 0 ? '#bbf7d0' : '#fecaca' }}>
            {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct)}%
            <span className="ml-1 font-normal opacity-80">{deltaCaption}</span>
          </p>
        )}
      </div>
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{value}</span>
        </div>
      </div>
    </div>
  );
}

export const GAUGE_TONES = ['var(--success)', 'var(--info)', 'var(--primary)', 'var(--warning)'];
