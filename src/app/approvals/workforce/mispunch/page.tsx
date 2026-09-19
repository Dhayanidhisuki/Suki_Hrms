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
import { DataTable, ConfirmDialog, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface MispunchRow {
  id: number;
  date: string;
  requestedInTime: string | null;
  requestedOutTime: string | null;
  reason: string;
  status?: string;
  managerActionAt?: string | null;
  hrActionAt?: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};
const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
};

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

function useMispunchQueue(scope: 'manager' | 'hr' | 'actioned') {
  const [records, setRecords] = useState<MispunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const toast = useToast();

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

function MispunchQueueSection({ title, scope, description }: { title: string; scope: 'manager' | 'hr'; description: string }) {
  const { records, loading, visible } = useMispunchQueue(scope);
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
    const res = await fetch(`/api/workforce/mispunch/${id}/approve`, { method: 'POST' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(body?.error ?? 'Approve failed');
      return;
    }
    setActioned((prev) => ({ ...prev, [id]: body?.status ?? body?.data?.status ?? (scope === 'manager' ? 'pending_hr' : 'approved') }));
  };

  const columns: Column<MispunchRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'requestedInTime', label: 'Requested In', render: (r) => formatWallClockTime(r.requestedInTime) },
    { key: 'requestedOutTime', label: 'Requested Out', render: (r) => formatWallClockTime(r.requestedOutTime) },
    { key: 'reason', label: 'Reason' },
    {
      key: 'outcome',
      label: 'Status',
      render: (r) => {
        const moved = actioned[r.id];
        if (!moved) {
          return <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Awaiting your review</span>;
        }
        const tone = STATUS_TONE[moved] ?? { bg: '#dcfce7', fg: '#166534' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[moved] ?? moved}
          </span>
        );
      },
    },
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

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="Nothing pending here."
        renderRowActions={(row) =>
          actioned[row.id] ? (
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
          )
        }
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
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? 'Reject failed');
          }
          if (rejectId !== null) setActioned((prev) => ({ ...prev, [rejectId]: 'rejected' }));
        }}
        submitLabel="Reject"
      />
    </div>
  );
}

/**
 * What this approver has already decided. A request leaves the pending queues
 * the moment it is actioned, so without this the approver has no record of
 * what they did — only the employee can see the outcome, on their own page.
 */
function MispunchHistorySection() {
  const { records, loading, visible } = useMispunchQueue('actioned');
  if (!visible) return null;

  const columns: Column<MispunchRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'requestedInTime', label: 'Requested In', render: (r) => formatWallClockTime(r.requestedInTime) },
    { key: 'requestedOutTime', label: 'Requested Out', render: (r) => formatWallClockTime(r.requestedOutTime) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status ?? ''] ?? { bg: '#f1f5f9', fg: '#475569' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[r.status ?? ''] ?? r.status}
          </span>
        );
      },
    },
    {
      key: 'actionedAt',
      label: 'My Action',
      render: (r) => {
        const at = r.hrActionAt ?? r.managerActionAt;
        return at ? new Date(at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
      },
    },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>My Approval History</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Requests you have already actioned, newest first. Read-only.
        </p>
      </div>
      <DataTable columns={columns} data={records} loading={loading} emptyMessage="You have not actioned any requests yet." />
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

      <MispunchHistorySection />
    </div>
  );
}
