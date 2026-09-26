'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '@/components/layout/navigation';
import { fetchCurrentUser } from '@/lib/currentUser';

/**
 * Horizontal tab strip mirroring one Masters sidebar group — lets you jump
 * between the group's pages without going back to the sidebar, while the
 * sidebar's own active-route highlighting stays in sync automatically
 * (Sidebar.tsx already highlights by pathname). Tabs are read straight from
 * navigation.ts so this can never drift out of sync with the sidebar itself.
 *
 * A plain reporting manager (employee access, no HR permissions) sees only
 * `managerQueue` items in the sidebar's Approval Center — mirror that here,
 * or a manager viewing this strip sees HR-only queues (e.g. LOM, Comp-Off)
 * that don't actually exist for them.
 */
export default function MasterGroupTabs({ groupLabel, moduleLabel = 'Masters' }: { groupLabel: string; moduleLabel?: string }) {
  const pathname = usePathname();
  const [managerOnly, setManagerOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((me) => {
      if (!cancelled) setManagerOnly(!!me?.hasEmployeeAccess && !me?.hasHrAccess);
    });
    return () => { cancelled = true; };
  }, []);

  const mod = navigation.find((m) => m.label === moduleLabel);
  const group = mod?.groups.find((g) => g.label === groupLabel);
  if (!group) return null;

  const items = moduleLabel === 'Approval Center' && managerOnly
    ? group.items.filter((i) => i.managerQueue)
    : group.items;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
      {items.map((item) => {
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
