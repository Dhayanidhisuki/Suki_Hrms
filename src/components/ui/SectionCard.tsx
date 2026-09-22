'use client';

import { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  description?: string;
  /** Count badge shown next to the title (e.g. number of rows in the queue). */
  count?: number;
  /** Right-aligned header controls. */
  actions?: ReactNode;
  children: ReactNode;
  /** Remove inner padding — useful when the body is a full-bleed table. */
  flush?: boolean;
  className?: string;
}

/**
 * Card container with an optional header strip. Groups a queue/table and its
 * toolbar into one visual unit so pages read as a set of panels rather than
 * loose headings and tables.
 */
export default function SectionCard({ title, description, count, actions, children, flush, className = '' }: SectionCardProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={`rounded-2xl border ${className}`}
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {title}
                {count !== undefined && (
                  <span
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                    style={{ backgroundColor: count > 0 ? 'var(--accent-soft)' : 'var(--surface-muted)', color: count > 0 ? 'var(--accent)' : 'var(--foreground-muted)' }}
                  >
                    {count}
                  </span>
                )}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}
