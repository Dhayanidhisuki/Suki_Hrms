'use client';

import { ReactNode } from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  neutral: { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' },
};

interface StatusBadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Show a small leading dot in the tone colour. */
  dot?: boolean;
  size?: 'xs' | 'sm';
  title?: string;
  /** Override colours entirely (e.g. admin-configured leave-type colour). */
  color?: string;
  className?: string;
}

/**
 * Compact pill for statuses/tags. Tone-driven so light and dark themes both
 * look right; pass `color` to force a specific hex (calendar leave types).
 */
export default function StatusBadge({ tone = 'neutral', children, dot, size = 'xs', title, color, className = '' }: StatusBadgeProps) {
  const t = tones[tone];
  const bg = color ? `${color}22` : t.bg;
  const fg = color ?? t.fg;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold ${size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${className}`}
      style={{ backgroundColor: bg, color: fg, borderColor: `${fg}40` }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fg }} aria-hidden />}
      {children}
    </span>
  );
}

/** Map common workflow statuses to a tone so pages don't each hand-roll a colour table. */
export function statusTone(status: string | null | undefined): BadgeTone {
  const s = (status ?? '').toLowerCase();
  if (['approved', 'ok', 'active', 'locked', 'posted', 'present', 'paid', 'completed'].includes(s)) return 'success';
  if (['pending', 'pending_manager', 'pending_hr', 'calculated', 'validated', 'submitted', 'hold', 'halfday'].includes(s)) return 'warning';
  if (['rejected', 'inactive', 'absent', 'failed', 'cancelled'].includes(s)) return 'danger';
  if (['draft', 'weeklyoff', 'holiday'].includes(s)) return 'info';
  return 'neutral';
}
