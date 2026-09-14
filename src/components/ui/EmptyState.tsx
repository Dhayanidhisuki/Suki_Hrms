'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

const DefaultIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8v13H3V8" />
    <path d="M1 3h22v5H1z" />
    <path d="M10 12h4" />
  </svg>
);

/** Friendly placeholder for empty tables/queues. */
export default function EmptyState({ title, description, icon, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-10'}`}>
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}
      >
        {icon ?? <DefaultIcon />}
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
