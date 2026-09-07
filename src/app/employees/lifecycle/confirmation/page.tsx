/**
 * Employees > Lifecycle > Confirmation — the "Pending Confirmations" queue:
 * employees whose probation has ended but haven't been confirmed yet.
 * Admin can Approve (sets Confirmation Date + offers the letter download),
 * Extend (picks a new probation end date), or Reject (marks resigned).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface PendingConfirmation {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  designation: { name: string } | null;
  joinDate: string;
  probationEndDate: string;
}

function daysOverdue(probationEndDate: string): number {
  const end = new Date(probationEndDate);
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/** Only future dates make sense for an extended probation end date — the
 * native date picker hides today and everything earlier via `min`. */
function buildExtendFields(): FieldDef[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);
  return [
    { name: 'newProbationEndDate', label: 'New Probation End Date', type: 'date', required: true, min: minDate },
    { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Reason for extending (optional)' },
  ];
}

const rejectFields: FieldDef[] = [
  { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Reason (optional)' },
];

export default function ConfirmationPendingPage() {
  const [items, setItems] = useState<PendingConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; letterHref?: string } | null>(null);

  const [approveTarget, setApproveTarget] = useState<PendingConfirmation | null>(null);
  const [extendTarget, setExtendTarget] = useState<PendingConfirmation | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingConfirmation | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/employees/confirmation-pending');
      if (!res.ok) throw new Error('Failed to fetch pending confirmations');
      const json = await res.json();
      setItems(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setError(null);
    try {
      const res = await fetch(`/api/employees/${approveTarget.id}/confirmation/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Approve failed');
      }
      setSuccessMsg({
        text: `${approveTarget.firstName} ${approveTarget.lastName} confirmed.`,
        letterHref: `/api/employees/${approveTarget.id}/confirmation/letter`,
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const handleExtend = async (values: Record<string, string | number | boolean>) => {
    if (!extendTarget) return;
    const res = await fetch(`/api/employees/${extendTarget.id}/confirmation/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Extend failed');
    }
    setSuccessMsg({ text: `Probation extended for ${extendTarget.firstName} ${extendTarget.lastName}.` });
    fetchData();
  };

  const handleReject = async (values: Record<string, string | number | boolean>) => {
    if (!rejectTarget) return;
    const res = await fetch(`/api/employees/${rejectTarget.id}/confirmation/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Reject failed');
    }
    setSuccessMsg({ text: `${rejectTarget.firstName} ${rejectTarget.lastName} marked resigned.` });
    fetchData();
  };

  const columns: Column<PendingConfirmation>[] = [
    { key: 'oldEmployeeCode', label: 'Employee Code', className: 'font-medium', render: (r) => r.oldEmployeeCode ?? `Ref: ${r.employeeCode}` },
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <Link href={`/employees/${row.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
          {row.firstName} {row.lastName}
        </Link>
      ),
    },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.designation?.name ?? '—' },
    { key: 'joinDate', label: 'Date of Joining', render: (row) => row.joinDate.slice(0, 10) },
    { key: 'probationEndDate', label: 'Probation End Date', render: (row) => row.probationEndDate.slice(0, 10) },
    {
      key: 'overdue',
      label: 'Days Overdue',
      render: (row) => {
        const days = daysOverdue(row.probationEndDate);
        return (
          <span style={{ color: days > 0 ? 'var(--warning)' : 'var(--foreground-muted)' }}>
            {days > 0 ? `${days}d` : 'Due today'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-3 text-xs font-medium whitespace-nowrap">
          <button onClick={() => setApproveTarget(row)} style={{ color: 'var(--success)' }} className="hover:underline">
            Approve
          </button>
          <button onClick={() => setExtendTarget(row)} style={{ color: 'var(--warning)' }} className="hover:underline">
            Extend
          </button>
          <button onClick={() => setRejectTarget(row)} style={{ color: 'var(--danger)' }} className="hover:underline">
            Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Pending Confirmations
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Employees whose probation period has ended and are awaiting a confirmation decision.
        </p>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg px-3 py-2 text-sm flex items-center justify-between" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
          <span>{successMsg.text}</span>
          {successMsg.letterHref && (
            <a href={successMsg.letterHref} className="font-medium hover:underline" style={{ color: 'var(--success)' }}>
              Download Confirmation Letter
            </a>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        emptyMessage="No pending confirmations — everyone with a completed probation has been reviewed."
      />

      <ConfirmDialog
        title="Confirm Employee"
        message={
          approveTarget
            ? `Confirm ${approveTarget.firstName} ${approveTarget.lastName}? This sets the Confirmation Date to today and makes them a permanent employee.`
            : ''
        }
        confirmLabel="Approve"
        isOpen={approveTarget !== null}
        onConfirm={handleApprove}
        onClose={() => setApproveTarget(null)}
      />

      <FormModal
        title={extendTarget ? `Extend Probation — ${extendTarget.firstName} ${extendTarget.lastName}` : 'Extend Probation'}
        fields={buildExtendFields()}
        initialValues={{}}
        isOpen={extendTarget !== null}
        onClose={() => setExtendTarget(null)}
        onSubmit={handleExtend}
        submitLabel="Extend"
      />

      <FormModal
        title={rejectTarget ? `Reject Confirmation — ${rejectTarget.firstName} ${rejectTarget.lastName}` : 'Reject Confirmation'}
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onSubmit={handleReject}
        submitLabel="Mark Resigned"
      />
    </div>
  );
}
