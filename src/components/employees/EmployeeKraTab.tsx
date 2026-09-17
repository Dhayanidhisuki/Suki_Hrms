/**
 * Employee Master → KPI / KRA tab.
 *
 * Read-only summary of the goal sets assigned to this employee, one card per
 * performance cycle. Building and submitting goals happens on
 * /performance/goals; this tab is the profile-level view of the same data.
 *
 * Replaces the earlier version, which read the ERP-era EmployeeKraCycle table
 * that migration 000067 dropped.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, EmptyState, Spinner, StatusBadge, type BadgeTone } from '@/components/ui';

interface GoalSetRow {
  id: number;
  status: 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'RETURNED';
  submittedAt: string | null;
  acceptedAt: string | null;
  cycle: { id: number; code: string; name: string; status: string };
  _count: { kras: number };
}

const STATUS_TONE: Record<GoalSetRow['status'], BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'success',
  RETURNED: 'danger',
};
const STATUS_LABEL: Record<GoalSetRow['status'], string> = {
  DRAFT: 'Draft',
  PENDING_ACCEPTANCE: 'Pending acceptance',
  ACCEPTED: 'Accepted',
  RETURNED: 'Returned by employee',
};

export default function EmployeeKraTab({ employeeId }: { employeeId: string | number }) {
  const [rows, setRows] = useState<GoalSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/goals?employeeId=${employeeId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load goals');
      setRows((await res.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  // See the note on the performance pages: this rule flags any setState
  // reachable from an effect, which every list screen here does.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No goals assigned"
        description="This employee has no KRA/KPI goals for any performance cycle yet."
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-medium">{row.cycle.code} — {row.cycle.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
              {row._count.kras} KRA{row._count.kras === 1 ? '' : 's'}
              {row.acceptedAt
                ? ` · accepted ${row.acceptedAt.slice(0, 10)}`
                : row.submittedAt
                  ? ` · submitted ${row.submittedAt.slice(0, 10)}`
                  : ''}
            </div>
          </div>
          <StatusBadge tone={STATUS_TONE[row.status]} dot>{STATUS_LABEL[row.status]}</StatusBadge>
          <Link
            href={`/performance/goals?cycleId=${row.cycle.id}`}
            className="text-sm underline"
            style={{ color: 'var(--accent)' }}
          >
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}
