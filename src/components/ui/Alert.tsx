'use client';

import { ReactNode } from 'react';

export type AlertTone = 'success' | 'warning' | 'danger' | 'info';

const tones: Record<AlertTone, { bg: string; fg: string; icon: ReactNode }> = {
  success: {
    bg: 'var(--success-soft)',
    fg: 'var(--success)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  warning: {
    bg: 'var(--warning-soft)',
    fg: 'var(--warning)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    ),
  },
  danger: {
    bg: 'var(--danger-soft)',
    fg: 'var(--danger)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    ),
  },
  info: {
    bg: 'var(--info-soft)',
    fg: 'var(--info)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
};

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Theme-aware inline banner for success / error / info messages. */
export default function Alert({ tone = 'info', children, onDismiss, className = '' }: AlertProps) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ${className}`}
      style={{ backgroundColor: t.bg, color: 'var(--foreground)', border: `1px solid ${t.fg}33` }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: t.fg }}>
        {t.icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded px-1 text-xs font-medium opacity-70 transition hover:opacity-100"
          style={{ color: t.fg }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
