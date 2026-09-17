/**
 * Permission Approval — two independent queues on one page, matching the
 * two-stage workflow the API implements: "Pending My Approval (Reporting
 * Manager)" is hierarchy-gated (scope=manager — only requests where the
 * logged-in employee is the requester's own reportingManagerId), and
 * "Pending HR Approval" is RBAC-gated (workforce.permission.approve —
 * scope=hr). A 403 on either fetch hides that section rather than erroring
 * the page, so a manager-only login sees just their own queue.
 *
 * On HR approval the API flags whether this pushes the employee over their
 * monthly free-hours allowance — surfaced here as a warning, not a block.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface PermissionRow {
  id: number;
  status?: string;
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

function usePermissionQueue(scope: 'manager' | 'hr' | 'actioned') {
  const [records, setRecords] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/permission?scope=${scope}`);
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: PermissionRow[] } = await res.json();
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

function PermissionQueueSection({ title, scope, description }: { title: string; scope: 'manager' | 'hr'; description: string }) {
  const { records, loading, visible, error, refetch } = usePermissionQueue(scope);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [approveResult, setApproveResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!visible) return null;

  const handleApprove = async (id: number) => {
    setActionError(null);
    const res = await fetch(`/api/workforce/permission/${id}/approve`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data.error ?? 'Approve failed');
      return;
    }
    // Only the HR stage reports the allowance overshoot; the manager stage
    // just advances the request, so there is nothing to warn about there.
    if (data.exceedsAllowance) {
      setApproveResult(`Approved — this pushes the employee ${Number(data.excessHours).toFixed(2)}h over their monthly free allowance. Handle the excess as an LOP adjustment.`);
    }
    refetch();
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
    <div className="space-y-2">
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{description}</p>
      </div>

      {(error || actionError) && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {actionError ?? error}
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
        title="Approve Permission"
        message={scope === 'manager' ? 'This sends the request on to HR for final approval. Continue?' : 'Approve this permission request?'}
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
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? 'Reject failed');
          }
          refetch();
        }}
        submitLabel="Reject"
      />
    </div>
  );
}

const HIST_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};

/**
 * What this approver has already decided. A request leaves both pending
 * queues the moment it is actioned, so without this the approver has no
 * record of it — only the employee sees the outcome, on their own page.
 */
function PermissionHistorySection() {
  const { records, loading, visible, error } = usePermissionQueue('actioned');
  if (!visible) return null;

  const columns: Column<PermissionRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'from', label: 'From', render: (r) => formatWallClockTime(r.fromTime) },
    { key: 'to', label: 'To', render: (r) => formatWallClockTime(r.toTime) },
    { key: 'hours', label: 'Hours', render: (r) => Number(r.hours).toFixed(2) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = HIST_TONE[r.status ?? ''] ?? { bg: '#f1f5f9', fg: '#475569' };
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{r.status}</span>;
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>My Approval History</h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Permission requests you have already actioned. Read-only.</p>
      </div>
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>
      )}
      <DataTable columns={columns} data={records} loading={loading} emptyMessage="You have not actioned any permission requests yet." />
    </div>
  );
}

export default function PermissionApprovalPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Permission Approval
      </h1>

      <PermissionQueueSection
        title="Pending My Approval (Reporting Manager)"
        scope="manager"
        description="Requests from your direct reports awaiting your review."
      />

      <PermissionQueueSection
        title="Pending HR Approval"
        scope="hr"
        description="Manager-approved requests awaiting final HR sign-off."
      />

      <PermissionHistorySection />
    </div>
  );
}
