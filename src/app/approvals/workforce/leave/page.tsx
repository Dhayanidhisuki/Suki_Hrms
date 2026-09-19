/**
 * Leave Approval — two-stage approval on one page:
 * 1. "Pending My Approval (Manager)" — shows requests for the logged-in
 *    manager's team members, hierarchy-gated via scope=manager.
 * 2. "Pending HR Approval" — requires workforce.leave.approve permission,
 *    scope=hr. For manager-only logins, this section 403s and is hidden.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface LeaveRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
  leaveMaster: { code: string; name: string };
}

const rejectFields: FieldDef[] = [
  { name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true },
];

function useLeaveQueue(scope: 'manager' | 'hr' | 'actioned') {
  const [records, setRecords] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/leave/applications?queue=${scope}`);
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: LeaveRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scope, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { records, loading, visible, refetch: fetchData };
}

function LeaveQueueSection({ title, scope, description }: { title: string; scope: 'manager' | 'hr'; description: string }) {
  const { records, loading, visible, refetch } = useLeaveQueue(scope);
  const toast = useToast();
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  // Rows this approver has just actioned, and the status each moved to.
  // Refetching here would drop the row out of the queue the instant it was
  // approved — the decision would vanish under the cursor with no
  // confirmation. Keep it in place showing its new status; it leaves the
  // queue on the next load, and "My Approval History" holds it after that.
  const [actioned, setActioned] = useState<Record<number, string>>({});
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  if (!visible) return null;

  const handleApprove = async (id: number) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/workforce/leave/applications/${id}/approve`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? 'Approve failed');
        return;
      }
      setActioned((prev) => ({ ...prev, [id]: body?.status ?? body?.data?.status ?? (scope === 'manager' ? 'pending_hr' : 'approved') }));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: number, values: Record<string, any>) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/workforce/leave/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: values.rejectionReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Reject failed');
        return;
      }
      setRejectId(null);
      refetch();
    } finally {
      setRejecting(false);
    }
  };

  const columns: Column<LeaveRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}`,
    },
    {
      key: 'leaveMaster',
      label: 'Leave Type',
      render: (r) => r.leaveMaster.name,
    },
    {
      key: 'fromDate',
      label: 'From',
      render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
    {
      key: 'toDate',
      label: 'To',
      render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
    },
    {
      key: 'numberOfDays',
      label: 'Days',
      render: (r) => `${Number(r.numberOfDays).toFixed(1)}${r.isHalfDay ? ' (H)' : ''}`,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r) => r.reason || '—',
    },
  ];

  const outcomeColumn: Column<LeaveRow> = {
    key: 'outcome',
    label: 'Status',
    render: (r) => {
      const moved = actioned[r.id];
      if (!moved) return <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Awaiting your review</span>;
      const tone = HIST_TONE[moved] ?? { bg: '#dcfce7', fg: '#166534' };
      return (
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
          {HIST_LABEL[moved] ?? moved}
        </span>
      );
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {description}
        </p>
      </div>

      <DataTable
        columns={[...columns, outcomeColumn]}
        data={records}
        loading={loading}
        emptyMessage="Nothing pending here."
        renderRowActions={(row) => actioned[row.id] ? (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Done</span>
        ) : (
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
        title="Approve Leave Application"
        message={
          scope === 'manager'
            ? 'This forwards the request to HR for final approval. Continue?'
            : "This will approve the leave and mark the requested dates as 'Leave' in attendance. Continue?"
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
        title="Reject Leave Application"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          if (rejectId) {
            await handleReject(rejectId, values);
          }
        }}
      />
    </div>
  );
}

const HIST_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#f1f5f9', fg: '#475569' },
};

const HIST_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/**
 * What this approver has already decided. A request leaves both pending
 * queues the moment it is actioned, so without this the approver has no
 * record of it — only the employee sees the outcome, on their own page.
 */
function LeaveHistorySection() {
  const { records, loading, visible } = useLeaveQueue('actioned');
  if (!visible) return null;

  const columns: Column<LeaveRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'numberOfDays', label: 'Days', render: (r) => Number(r.numberOfDays).toFixed(1) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = HIST_TONE[r.status] ?? { bg: '#f1f5f9', fg: '#475569' };
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{HIST_LABEL[r.status ?? ''] ?? r.status}</span>;
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>My Approval History</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave requests you have already actioned. Read-only.</p>
      </div>
      <DataTable columns={columns} data={records} loading={loading} emptyMessage="You have not actioned any leave requests yet." />
    </div>
  );
}

export default function LeaveApprovalPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Leave Approval
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Two-stage approval: Manager review, then HR finalization.
        </p>
      </div>

      <LeaveQueueSection
        title="Pending My Approval (Reporting Manager)"
        scope="manager"
        description="Leave requests from your team members awaiting your review."
      />

      <LeaveQueueSection
        title="Pending HR Approval"
        scope="hr"
        description="Manager-approved requests awaiting HR finalization. Approved requests will deduct leave balance and mark attendance."
      />

      <LeaveHistorySection />
    </div>
  );
}
