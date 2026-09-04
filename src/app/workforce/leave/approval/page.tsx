/**
 * Leave Approval — pending queue with Approve / Reject actions (BRD §11).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface LeaveApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  reason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  leaveMaster: { code: string; name: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

export default function LeaveApprovalPage() {
  const [records, setRecords] = useState<LeaveApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/leave/applications?status=pending');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: LeaveApplicationRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/leave/applications/${id}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Approve failed');
      return;
    }
    fetchData();
  };

  const columns: Column<LeaveApplicationRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString() },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString() },
    { key: 'numberOfDays', label: 'Days' },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Leave Approval
      </h1>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No pending leave applications."
        renderRowActions={(row) => (
          <>
            <button onClick={() => setApproveId(row.id)} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>
              Approve
            </button>
            <button onClick={() => setRejectId(row.id)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>
              Reject
            </button>
          </>
        )}
      />

      <ConfirmDialog
        title="Approve Leave"
        message="This will deduct the days from the employee's leave balance and mark those dates as Leave on their attendance. Continue?"
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />

      <FormModal
        title="Reject Leave"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/leave/applications/${rejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: values.rejectionReason }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          fetchData();
        }}
        submitLabel="Reject"
      />
    </div>
  );
}
