/**
 * Permission Approval — pending queue, single-stage RBAC approval
 * (workforce.permission.approve), same pattern as Leave Approval. On
 * approve, the API flags whether this pushes the employee over their
 * monthly free-hours allowance — shown here as a warning, not blocked.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface PermissionRow {
  id: number;
  date: string;
  fromTime: string;
  toTime: string;
  hours: number;
  reason: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function formatWallClockTime(iso: string): string {
  const d = new Date(iso);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function PermissionApprovalPage() {
  const [records, setRecords] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveResult, setApproveResult] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/permission?scope=hr');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: PermissionRow[] } = await res.json();
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
    const res = await fetch(`/api/workforce/permission/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Approve failed');
      return;
    }
    if (data.exceedsAllowance) {
      setApproveResult(`Approved — this pushes the employee ${Number(data.excessHours).toFixed(2)}h over their monthly free allowance. Handle the excess as an LOP adjustment.`);
    }
    fetchData();
  };

  const columns: Column<PermissionRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'from', label: 'From', render: (r) => formatWallClockTime(r.fromTime) },
    { key: 'to', label: 'To', render: (r) => formatWallClockTime(r.toTime) },
    { key: 'hours', label: 'Hours', render: (r) => Number(r.hours).toFixed(2) },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Permission Approval
      </h1>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
      {approveResult && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
          {approveResult}
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No pending permission requests."
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
        title="Approve Permission"
        message="Approve this permission request?"
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />

      <FormModal
        title="Reject Permission"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/permission/${rejectId}/reject`, {
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
