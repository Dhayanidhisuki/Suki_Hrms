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
  subtitle?: string;
  tone?: KPITone;
  icon?: ReactNode;
  animationDuration?: number;
  trend?: KPITrend;
  title?: string;
  className?: string;
}

export default function KPICard({
  label,
  value,
  subtitle,
  tone = 'info',
  icon,
  animationDuration = 600,
  count,
  format,
  trend,
  title,
  className = '',
}: KPICardProps) {
  const style = toneStyles[tone];
  const DefaultIcon = DEFAULT_ICONS[tone];
  const direction = trend?.direction ?? 'up';
  const TrendIcon =
    direction === 'down' ? ArrowDown : direction === 'neutral' ? Minus : ArrowUp;
  const hasTrend = Boolean(trend?.value);
  const footerLabel = trend?.label ?? subtitle;
  const hasFooter = hasTrend || Boolean(footerLabel);

  return (
    <div
      title={title}
      className={`flex h-full min-h-[132px] flex-col rounded-[20px] border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-200 hover:shadow-md ${className}`.trim()}
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4"
          style={{ backgroundColor: style.bg, color: style.fg }}
        >
          {icon ?? <DefaultIcon />}
        </div>
        <p className="truncate text-[13px] font-medium leading-none" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>

      <p
        className="mt-4 text-[28px] font-medium leading-none tracking-tight tabular-nums"
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

      {hasFooter ? (
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
            <span className="truncate font-medium" style={{ color: 'var(--text-muted)' }}>
              {footerLabel}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-auto min-h-[20px] pt-3" />
      )}
    </div>
  );
}
