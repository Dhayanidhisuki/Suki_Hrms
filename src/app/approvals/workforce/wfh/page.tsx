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
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface WfhRow {
  id: number;
  fromDate: string;
  toDate: string;
  reason: string;
  remarks: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

function useWfhQueue(scope: 'manager' | 'hr') {
  const [records, setRecords] = useState<WfhRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

function WfhQueueSection({ title, scope, description }: { title: string; scope: 'manager' | 'hr'; description: string }) {
  const { records, loading, visible, error, refetch } = useWfhQueue(scope);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  if (!visible) return null;

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/workforce/wfh/${id}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? 'Approve failed');
      return;
    }
    refetch();
  };

  const columns: Column<WfhRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
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
          refetch();
        }}
        submitLabel="Reject"
      />
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
    </div>
  );
}
