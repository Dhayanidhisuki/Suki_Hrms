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
import { DataTable, KPICard, KPIGrid, useToast, type Column } from '@/components/ui';

interface CompOffRow {
  id: number;
  workedDate: string;
  requestedDate: string;
  reason: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface LeaveBalanceRow {
  id: number;
  accrued: string;
  availed: string;
  closingBalance: string;
  leaveMaster: { code: string; name: string };
}

interface LeaveApplicationRow {
  fromDate: string;
  toDate: string;
  status: string;
  leaveMaster: { code: string };
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
  const [balance, setBalance] = useState<LeaveBalanceRow | null>(null);
  const [usedDates, setUsedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const [compOffRes, leaveRes] = await Promise.all([
        fetch('/api/workforce/comp-off-request'),
        fetch(`/api/workforce/my-leave?year=${year}`),
      ]);
      if (!compOffRes.ok) throw new Error((await compOffRes.json().catch(() => ({}))).error ?? 'Failed to fetch');
      const compOffJson: { data: CompOffRow[] } = await compOffRes.json();
      setRecords(compOffJson.data ?? []);

      if (leaveRes.ok) {
        const leaveJson: { balances: LeaveBalanceRow[]; applications: LeaveApplicationRow[] } = await leaveRes.json();
        setBalance((leaveJson.balances ?? []).find((b) => b.leaveMaster.code === 'COMPOFF') ?? null);
        const dates = (leaveJson.applications ?? [])
          .filter((a) => a.leaveMaster.code === 'COMPOFF' && a.status === 'approved')
          .map((a) => (a.fromDate === a.toDate ? fmtDate(a.fromDate) : `${fmtDate(a.fromDate)} – ${fmtDate(a.toDate)}`));
        setUsedDates(dates);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
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

  const credited = balance ? Number(balance.accrued) : 0;
  const used = balance ? Number(balance.availed) : 0;
  const remaining = balance ? Number(balance.closingBalance) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Comp-Off</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          To take a comp-off day, apply through <strong>Leave</strong> and pick <strong>Compensatory Off</strong> as the leave type,
          once it&apos;s been credited to your balance. This page shows your balance and comp-off history only.
        </p>
      </div>

      {!loading && (
        <KPIGrid columns={3}>
          <KPICard label="Available" value={credited} suffix="days" tone="info" />
          <KPICard
            label="Used"
            value={used}
            suffix="days"
            tone="warning"
            subtitle={usedDates.length > 0 ? usedDates.join(', ') : 'None used yet'}
          />
          <KPICard label="Remaining" value={remaining} suffix="days" tone={remaining > 0 ? 'success' : 'danger'} />
        </KPIGrid>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No comp-off history yet." />
    </div>
  );
}
