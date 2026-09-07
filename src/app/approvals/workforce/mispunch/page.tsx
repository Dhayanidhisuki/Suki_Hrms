/**
 * Mispunch Approval — two independent queues on one page, since the
 * workflow has two stages with different authorization: "Pending My
 * Approval (Reporting Manager)" is hierarchy-gated (only shows requests
 * where the logged-in employee is the requester's own reportingManagerId —
 * scope=manager on the API), and "Pending HR Approval" is RBAC-gated
 * (workforce.mispunch.approve — scope=hr). The HR section's fetch 403ing is
 * expected for a manager-only login and simply hides that section rather
 * than erroring the page.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface MispunchRow {
  id: number;
  date: string;
  requestedInTime: string | null;
  requestedOutTime: string | null;
  reason: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function formatWallClockTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function useMispunchQueue(scope: 'manager' | 'hr') {
  const [records, setRecords] = useState<MispunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/mispunch?scope=${scope}`);
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: MispunchRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, loading, visible, error, refetch: fetchData };
}

function MispunchQueueSection({ title, scope, description }: { title: string; scope: 'manager' | 'hr'; description: string }) {
  const { records, loading, visible, error, refetch } = useMispunchQueue(scope);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  if (!visible) return null;

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/mispunch/${id}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? 'Approve failed');
      return;
    }
    refetch();
  };

  const columns: Column<MispunchRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'requestedInTime', label: 'Requested In', render: (r) => formatWallClockTime(r.requestedInTime) },
    { key: 'requestedOutTime', label: 'Requested Out', render: (r) => formatWallClockTime(r.requestedOutTime) },
    { key: 'reason', label: 'Reason' },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {description}
        </p>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="Nothing pending here."
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
        title="Approve Mis-Punch Correction"
        message={
          scope === 'manager'
            ? 'This sends the request on to HR for final approval. Continue?'
            : "This will update the employee's attendance for that day with the requested in/out times. Continue?"
        }
        confirmLabel="Approve"
        isOpen={approveId !== null}
        onConfirm={() => {
          if (approveId) handleApprove(approveId);
          setApproveId(null);
        }}
        onClose={() => setApproveId(null)}
      />

      <FormModal
        title="Reject Mis-Punch Correction"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/mispunch/${rejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: values.rejectionReason }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          refetch();
        }}
        submitLabel="Reject"
      />
    </div>
  );
}

export default function MispunchApprovalPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Mispunch Approval
      </h1>

      <MispunchQueueSection
        title="Pending My Approval (Reporting Manager)"
        scope="manager"
        description="Requests from your direct reports awaiting your review."
      />

      <MispunchQueueSection
        title="Pending HR Approval"
        scope="hr"
        description="Requests already reviewed by the Reporting Manager, awaiting final HR approval. Approving here updates attendance."
      />
    </div>
  );
}
