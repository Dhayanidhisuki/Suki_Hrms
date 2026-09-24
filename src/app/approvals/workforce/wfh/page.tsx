/**
 * WFH Approval — two independent queues on one page, since the workflow
 * has two stages with different authorization: "Pending My Approval
 * (Reporting Manager)" is hierarchy-gated (only shows requests where the
 * logged-in employee is the requester's own reportingManagerId —
 * scope=manager on the API), and "Pending HR Approval" is RBAC-gated
 * (workforce.wfh.approve — scope=hr). The HR section's fetch 403ing is
 * expected for a manager-only login and simply hides that section rather
 * than erroring the page.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface WfhRow {
  id: number;
  status?: string;
  fromDate: string;
  toDate: string;
  reason: string;
  remarks: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function useWfhQueue(scope: 'manager' | 'hr' | 'actioned') {
  const [records, setRecords] = useState<WfhRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/wfh?scope=${scope}`);
      if (res.status === 403) {
        setVisible(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: WfhRow[] } = await res.json();
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

function WfhQueueSection({ title, scope, description }: { title: string; scope: 'manager' | 'hr'; description: string }) {
  const { records, loading, visible, refetch } = useWfhQueue(scope);
  const toast = useToast();
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  // Rows this approver has just actioned, and the status each moved to.
  // Refetching here would drop the row out of the queue the instant it was
  // approved — the decision would vanish under the cursor with no
  // confirmation. Keep it in place showing its new status; it leaves the
  // queue on the next load, and "My Approval History" holds it after that.
  const [actioned, setActioned] = useState<Record<number, string>>({});

  if (!visible) return null;

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/wfh/${id}/approve`, { method: 'POST' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(body?.error ?? 'Approve failed');
      return;
    }
    setActioned((prev) => ({ ...prev, [id]: body?.status ?? body?.data?.status ?? (scope === 'manager' ? 'pending_hr' : 'approved') }));
    toast.success('WFH request approved.');
  };

  const columns: Column<WfhRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'reason', label: 'Reason' },
  ];

  const outcomeColumn: Column<WfhRow> = {
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
    <div className="space-y-2">
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
        title="Approve WFH Request"
        message={
          scope === 'manager'
            ? 'This sends the request on to HR for final approval. Continue?'
            : "This will mark the covered days as Present in the employee's attendance. Continue?"
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
        title="Reject WFH Request"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={async (values) => {
          const res = await fetch(`/api/workforce/wfh/${rejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: values.rejectionReason }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          if (rejectId !== null) setActioned((prev) => ({ ...prev, [rejectId]: 'rejected' }));
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
function WfhHistorySection() {
  const { records, loading, visible } = useWfhQueue('actioned');
  if (!visible) return null;

  const columns: Column<WfhRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'reason', label: 'Reason', render: (r) => r.reason },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = HIST_TONE[r.status ?? ''] ?? { bg: '#f1f5f9', fg: '#475569' };
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{HIST_LABEL[r.status ?? ''] ?? r.status}</span>;
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>My Approval History</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Requests you have already actioned. Read-only.</p>
      </div>
      <DataTable columns={columns} data={records} loading={loading} emptyMessage="You have not actioned any requests yet." />
    </div>
  );
}

export default function WfhApprovalPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        WFH Approval
      </h1>

      <WfhQueueSection
        title="Pending My Approval (Reporting Manager)"
        scope="manager"
        description="Requests from your direct reports awaiting your review."
      />

      <WfhQueueSection
        title="Pending HR Approval"
        scope="hr"
        description="Requests already reviewed by the Reporting Manager, awaiting final HR approval. Approving here marks the covered days present in attendance."
      />

      <WfhHistorySection />
    </div>
  );
}
