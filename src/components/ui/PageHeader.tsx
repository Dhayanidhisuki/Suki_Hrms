'use client';

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned controls (buttons, selects, badges). */
  actions?: ReactNode;
  /** Small eyebrow label rendered above the title, e.g. "Time Office". */
  eyebrow?: string;
}

/**
 * Standard page heading — eyebrow, title, one-line description and an
 * actions slot. Purely presentational; keeps every page's top strip aligned.
 */
export default function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
