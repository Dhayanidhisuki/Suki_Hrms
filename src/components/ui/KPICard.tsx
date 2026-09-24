'use client';

import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CircleAlert,
  Clock,
  Minus,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AnimatedCountUp } from './AnimatedCountUp';

export type KPITone = 'success' | 'warning' | 'danger' | 'info' | 'accent';

export type KPITrendDirection = 'up' | 'down' | 'neutral';

export interface KPITrend {
  direction?: KPITrendDirection;
  /** Highlighted delta, e.g. "$31.2K" */
  value?: string;
  /** Muted comparison label, e.g. "vs last month" */
  label?: string;
}

const toneStyles: Record<KPITone, { bg: string; fg: string }> = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
  accent: { bg: 'var(--primary-light)', fg: 'var(--primary)' },
};

const DEFAULT_ICONS: Record<KPITone, LucideIcon> = {
  warning: Clock,
  info: Users,
  success: Package,
  danger: CircleAlert,
  accent: BarChart3,
};

const TREND_COLOR: Record<KPITrendDirection, string> = {
  up: 'var(--success)',
  down: 'var(--danger)',
  neutral: 'var(--text-muted)',
};

interface KPICardProps {
  label: string;
  value: string | number;
  /** Animate to this number and render it through `format`. */
  count?: number;
  /** Formats each animation frame, e.g. a currency or percentage. */
  format?: (n: number) => string;
  /** Caption under the value. A node, so a page can lead it with a status icon. */
  subtitle?: ReactNode;
  /**
   * Unit rendered after the value in muted type, e.g. "Members" in
   * "18 Members". For a figure measured against a ceiling use `progress`.
   */
  suffix?: string;
  /** Colours the caption — use for a caption that reports a state, not a note. */
  subtitleTone?: KPITone;
  /** Small chip beside the value, e.g. "63.6%" next to a count. */
  badge?: string;
  /**
   * Draws the card in its tone's colour — for a figure that is asking to be
   * acted on (unassigned reports, overdue items), not merely reported.
   */
  highlight?: boolean;
  /** Inline call to action in the footer, e.g. "Resolve (4)". */
  action?: { label: string; onClick: () => void };
  tone?: KPITone;
  icon?: ReactNode;
  animationDuration?: number;
  trend?: KPITrend;
  /**
   * Renders "<value> / <max> <label>" plus a fill bar under the number, for a
   * figure that only means something against a ceiling (headcount vs
   * sanctioned, spend vs budget). Takes the place of the footer line.
   */
  progress?: { max: number; label?: string };
  title?: string;
  className?: string;
}

export default function KPICard({
  label,
  value,
  subtitle,
  tone = 'info',
  icon,
  suffix,
  subtitleTone,
  badge,
  highlight = false,
  action,
  animationDuration = 600,
  count,
  format,
  trend,
  progress,
  title,
  className = '',
}: KPICardProps) {
  const style = toneStyles[tone];
  const DefaultIcon = DEFAULT_ICONS[tone];
  const direction = trend?.direction ?? 'up';
  const TrendIcon =
    direction === 'down' ? ArrowDown : direction === 'neutral' ? Minus : ArrowUp;
  const hasTrend = Boolean(trend?.value);
  // Clamped so an over-ceiling figure (headcount above sanctioned) fills the
  // bar instead of overflowing the card, and a zero ceiling cannot divide by 0.
  const numericValue = typeof count === 'number' ? count : typeof value === 'number' ? value : 0;
  const pct = progress && progress.max > 0
    ? Math.min(100, Math.max(0, (numericValue / progress.max) * 100))
    : 0;
  const footerLabel = trend?.label ?? subtitle;
  const hasFooter = hasTrend || Boolean(footerLabel) || Boolean(action);

  return (
    <div
      title={title}
      className={`flex h-full min-h-[132px] flex-col rounded-[20px] border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-200 hover:shadow-md ${className}`.trim()}
      style={{
        backgroundColor: highlight ? style.bg : 'var(--bg-card)',
        borderColor: highlight ? style.fg : 'var(--border-main)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 pt-0.5">
          <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4" style={{ color: style.fg }}>
            {icon ?? <DefaultIcon />}
          </span>
          <p className="truncate text-[13px] font-medium leading-none" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
        </div>
        {/* The same glyph again as a tinted block on the right: it is what
            anchors the card's right edge so a row of cards reads as a grid
            rather than as ragged text. */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5"
          // On a highlighted card the surface is already the tone's tint, so the
          // chip flips to the card colour instead of disappearing into it.
          style={{ backgroundColor: highlight ? 'var(--bg-card)' : style.bg, color: style.fg }}
          aria-hidden="true"
        >
          {icon ?? <DefaultIcon />}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <p
          className="text-[28px] font-semibold leading-none tracking-tight tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
        {/* `count` + `format` let a currency or percentage figure count up too;
            a bare number animates on its own; anything else (an em dash for
            "no data") is printed as-is. */}
        {typeof count === 'number' ? (
          <AnimatedCountUp value={count} duration={animationDuration} format={format} />
        ) : typeof value === 'number' ? (
          <AnimatedCountUp value={value} duration={animationDuration} />
        ) : (
            value
          )}
        </p>
        {progress ? (
          <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
            / {progress.max.toLocaleString('en-IN')} {progress.label}
          </span>
        ) : badge ? (
          <span
            className="rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums"
            style={{ backgroundColor: highlight ? 'var(--bg-card)' : style.bg, color: style.fg }}
          >
            {badge}
          </span>
        ) : suffix ? (
          <span className="text-[15px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        ) : null}
      </div>

      {progress ? (
        <div className="mt-auto pt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border-main)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: style.fg,
              }}
            />
          </div>
        </div>
      ) : hasFooter ? (
        <div className="mt-auto flex min-h-[20px] items-center gap-1 pt-3 text-[12px] leading-none">
          {hasTrend ? (
            <>
              <TrendIcon className="h-3.5 w-3.5 shrink-0" style={{ color: TREND_COLOR[direction] }} />
              <span className="font-medium tabular-nums" style={{ color: TREND_COLOR[direction] }}>
                {trend!.value}
              </span>
            </>
          ) : null}
          {footerLabel ? (
            <span
              className="flex min-w-0 items-center gap-1 truncate font-medium [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0"
              style={{ color: subtitleTone ? toneStyles[subtitleTone].fg : 'var(--text-muted)' }}
            >
              {footerLabel}
            </span>
          ) : null}
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="ml-auto shrink-0 cursor-pointer font-semibold underline underline-offset-2 hover:opacity-80"
              style={{ color: style.fg }}
            >
              {action.label}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-auto min-h-[20px] pt-3" />
      )}
    </div>
  );
}
