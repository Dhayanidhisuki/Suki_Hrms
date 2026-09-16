/**
 * Salary Revision Approval — approve salary revision requests.
 * Statuses: DRAFT → SUBMITTED → APPROVED
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface SalaryRevision {
  id: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  currentGross: string;
  incrementAmount: string;
  incrementPercent: string;
  revisedGross: string;
  status: string;
  effectiveDate: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f1f5f9', fg: '#475569' },
  SUBMITTED: { bg: '#fef3c7', fg: '#92400e' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  HELD: { bg: '#e5e7eb', fg: '#374151' },
};

const rejectFields: FieldDef[] = [{ name: 'reason', label: 'Rejection Reason', type: 'textarea', required: true }];

export default function SalaryRevisionApprovalPage() {
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payroll/revisions?status=SUBMITTED');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to load salary revisions');
      }
      const json = await res.json();
      setRevisions(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load salary revisions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  const handleApprove = async (id: number) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/payroll/revisions/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Approve failed');
      }
      fetchRevisions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: number, values: Record<string, any>) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/payroll/revisions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: values.reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Reject failed');
      }
      setRejectId(null);
      fetchRevisions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const columns: Column<SalaryRevision>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}`,
    },
    {
      key: 'currentGross',
      label: 'Current Gross',
      render: (r) => `₹${Number(r.currentGross).toLocaleString('en-IN')}`,
    },
    {
      key: 'increment',
      label: 'Increment',
      render: (r) => `₹${Number(r.incrementAmount).toLocaleString('en-IN')} (${Number(r.incrementPercent).toFixed(2)}%)`,
    },
    {
      key: 'revisedGross',
      label: 'Revised Gross',
      render: (r) => `₹${Number(r.revisedGross).toLocaleString('en-IN')}`,
    },
    {
      key: 'effectiveDate',
      label: 'Effective',
      render: (r) => new Date(r.effectiveDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Salary Revision Approval
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Review and approve salary revision requests from HR.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={revisions}
        loading={loading}
        emptyMessage="No pending salary revision requests."
        renderRowActions={(row) => (
          <>
            <button
              onClick={() => setApproveId(row.id)}
              disabled={approving}
              className="mr-3 text-xs font-medium hover:underline disabled:opacity-50"
              style={{ color: '#166534' }}
            >
              Approve
            </button>
            <button
              onClick={() => setRejectId(row.id)}
              disabled={rejecting}
              className="text-xs font-medium hover:underline disabled:opacity-50"
              style={{ color: '#991b1b' }}
            >
              Reject
            </button>
          </>
        )}
      />

      <ConfirmDialog
        title="Approve Salary Revision"
        message="Approve this salary revision request? The new gross will be effective from the specified date."
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />

      <FormModal
        title="Reject Salary Revision"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          if (rejectId) await handleReject(rejectId, values);
        }}
      />
    </div>
  );
}
