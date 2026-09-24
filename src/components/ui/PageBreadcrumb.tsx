'use client';

import Link from 'next/link';

/** "Dashboard / My Requests"-style trail above an ESS request page's title. */
export default function PageBreadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <p className="text-xs">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span className="mx-1.5" style={{ color: 'var(--text-muted)' }}>/</span>}
          {item.href ? (
            <Link href={item.href} className="text-[var(--primary)] hover:underline">{item.label}</Link>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </p>
  );
}
