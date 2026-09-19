/**
 * Salary Processing Approval — approve payroll runs.
 * Statuses: DRAFT → CALCULATED → VALIDATED → SUBMITTED → APPROVED
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, useToast, type Column } from '@/components/ui';

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: string;
  createdAt: string;
  approvedAt?: string;
  _count: { lines: number };
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f1f5f9', fg: '#475569' },
  CALCULATED: { bg: '#dbeafe', fg: '#1e40af' },
  VALIDATED: { bg: '#fef3c7', fg: '#92400e' },
  SUBMITTED: { bg: '#fbbf24', fg: '#78350f' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  LOCKED: { bg: '#e5e7eb', fg: '#374151' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SalaryProcessingApprovalPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/runs');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to load payroll runs');
      }
      const json = await res.json();
      // Filter to runs that can be approved (CALCULATED, VALIDATED, SUBMITTED)
      const approvable = (json.data ?? []).filter((r: PayrollRun) =>
        ['CALCULATED', 'VALIDATED', 'SUBMITTED'].includes(r.status)
      );
      setRuns(approvable);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleApprove = async (id: number) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/payroll/runs/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Approve failed');
      }
      fetchRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const columns: Column<PayrollRun>[] = [
    {
      key: 'period',
      label: 'Period',
      render: (r) => `${monthNames[r.month - 1]} ${r.year}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f1f5f9', fg: '#475569' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {r.status}
          </span>
        );
      },
    },
    {
      key: 'lines',
      label: 'Employees',
      render: (r) => r._count.lines,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r) => new Date(r.createdAt).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
    {
      key: 'approvedAt',
      label: 'Approved',
      render: (r) => (r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('en-IN', { timeZone: 'UTC' }) : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Salary Processing Approval
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Review and approve payroll runs before final processing.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={runs}
        loading={loading}
        emptyMessage="No pending payroll runs for approval."
        renderRowActions={(row) => (
          <button
            onClick={() => setApproveId(row.id)}
            disabled={approving}
            className="text-xs font-medium hover:underline disabled:opacity-50"
            style={{ color: '#166534' }}
          >
            Approve
          </button>
        )}
      />

      <ConfirmDialog
        title="Approve Payroll Run"
        message={`Approve payroll for ${runs.find((r) => r.id === approveId) ? monthNames[(runs.find((r) => r.id === approveId)?.month ?? 1) - 1] : ''} ${
          runs.find((r) => r.id === approveId)?.year
        }? This will process ${runs.find((r) => r.id === approveId)?._count.lines ?? 0} employees. Continue?`}
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />
    </div>
  );
}
