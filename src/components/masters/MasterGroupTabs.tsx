'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '@/components/layout/navigation';

/**
 * Horizontal tab strip mirroring one Masters sidebar group — lets you jump
 * between the group's pages without going back to the sidebar, while the
 * sidebar's own active-route highlighting stays in sync automatically
 * (Sidebar.tsx already highlights by pathname). Tabs are read straight from
 * navigation.ts so this can never drift out of sync with the sidebar itself.
 */
export default function MasterGroupTabs({ groupLabel }: { groupLabel: string }) {
  const pathname = usePathname();
  const mastersModule = navigation.find((m) => m.label === 'Masters');
  const group = mastersModule?.groups.find((g) => g.label === groupLabel);
  if (!group) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
      {group.items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap px-4 py-2 text-sm font-medium transition"
            style={{
              color: active ? 'var(--accent)' : 'var(--foreground-muted)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
