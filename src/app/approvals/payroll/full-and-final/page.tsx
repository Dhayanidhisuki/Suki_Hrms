/**
 * Full & Final Settlement Approval — approve FnF settlements for exiting employees.
 * Statuses: pending → approved → paid
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface FnFSettlement {
  id: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  exitInterview: { exitDate: string; exitType: string; exitReason: string };
  lastWorkingDay: string;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  paid: { bg: '#f1f5f9', fg: '#475569' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};

const rejectFields: FieldDef[] = [{ name: 'reason', label: 'Rejection Reason', type: 'textarea', required: true }];

export default function FullAndFinalApprovalPage() {
  const [settlements, setSettlements] = useState<FnFSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/fnf?status=pending');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to load FnF settlements');
      }
      const json = await res.json();
      setSettlements(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load FnF settlements');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleApprove = async (id: number) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/payroll/fnf/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Approve failed');
      }
      fetchSettlements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: number, values: Record<string, any>) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/payroll/fnf/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: values.reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Reject failed');
      }
      setRejectId(null);
      fetchSettlements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const columns: Column<FnFSettlement>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}`,
    },
    {
      key: 'exitDate',
      label: 'Exit Date',
      render: (r) => new Date(r.exitInterview.exitDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
    {
      key: 'exitType',
      label: 'Exit Type',
      render: (r) => r.exitInterview.exitType,
    },
    {
      key: 'exitReason',
      label: 'Reason',
      render: (r) => r.exitInterview.exitReason || '—',
    },
    {
      key: 'lastWorkingDay',
      label: 'Last Working Day',
      render: (r) => new Date(r.lastWorkingDay).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Full & Final Settlement Approval
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Review and approve Full & Final settlements for exiting employees.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={settlements}
        loading={loading}
        emptyMessage="No pending Full & Final settlements for approval."
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
        title="Approve Full & Final Settlement"
        message="Approve this Full & Final settlement? The settlement will be marked as approved and ready for payment processing."
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />

      <FormModal
        title="Reject Full & Final Settlement"
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
