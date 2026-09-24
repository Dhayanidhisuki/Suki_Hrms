/**
 * Employee Self Service — Comp-Off. View-only: applying for Compensatory
 * Off now happens through the regular "Apply for Leave" form (Services >
 * Leave), which already lists Compensatory Off as a leave type once it's
 * been credited — one entry point instead of two. This page shows the
 * balance (credited / used / remaining) and the history of comp-off claims,
 * for continuity. Self-service: employeeId is resolved from the session.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, KPICard, KPIGrid, PageBreadcrumb, useToast, type Column } from '@/components/ui';

interface CompOffRow {
  id: number;
  workedDate: string;
  requestedDate: string;
  reason: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface CompOffBalance {
  available: number;
  earned: number;
  used: number;
  expired: number;
  encashed: number;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef9c3', fg: '#854d0e' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'UTC' });

export default function EssCompOffPage() {
  const [records, setRecords] = useState<CompOffRow[]>([]);
  const [balance, setBalance] = useState<CompOffBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/comp-off-request');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to fetch');
      const json: { data: CompOffRow[]; balance: CompOffBalance | null } = await res.json();
      setRecords(json.data ?? []);
      setBalance(json.balance ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const columns: Column<CompOffRow>[] = [
    { key: 'workedDate', label: 'Worked On', render: (r) => fmtDate(r.workedDate) },
    { key: 'requestedDate', label: 'Comp-Off Date', render: (r) => fmtDate(r.requestedDate) },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        );
      },
    },
    { key: 'rejectionReason', label: 'Rejection Reason', render: (r) => r.rejectionReason ?? '—' },
  ];

  const credited = balance ? balance.earned : 0;
  const used = balance ? balance.used : 0;
  const remaining = balance ? balance.available : 0;

  return (
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'Comp-Off' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Comp-Off</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          To take a comp-off day, apply through <strong>Leave</strong> and pick <strong>Compensatory Off</strong> as the leave type,
          once it&apos;s been credited to your balance. This page shows your balance and comp-off history only.
        </p>
      </div>

      {!loading && balance && balance.earned > 0 && (
        <KPIGrid columns={3}>
          <KPICard label="Earned" value={credited} suffix="days" tone="info" />
          <KPICard label="Used" value={used} suffix="days" tone="warning" />
          <KPICard label="Remaining" value={remaining} suffix="days" tone={remaining > 0 ? 'success' : 'danger'} />
        </KPIGrid>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No comp-off history yet." />
    </div>
  );
}
