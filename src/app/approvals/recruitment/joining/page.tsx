/**
 * Employee Joining Approval — BRD §8, §16.3.3.
 * Lists CandidateJoinings in 'Joining Approval' status awaiting approval.
 * Approve → status 'Joined' (enables Push to Employee).
 * Reject  → status 'Rejected'.
 * Hold    → status 'Joining Approval' (with remarks).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface JoiningRow {
  id: number;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string; department?: { name: string } | null; designation?: { name: string } | null };
  joiningDate: string | null;
  joiningStatus: string;
  approvalStatus: string;
  approvalRemarks: string | null;
  createdAt: string;
}

const actionFields: FieldDef[] = [{ name: 'remarks', label: 'Remarks', type: 'textarea', required: true }];

export default function EmployeeJoiningApprovalPage() {
  const [records, setRecords] = useState<JoiningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionRow, setActionRow] = useState<{ row: JoiningRow; action: 'Approved' | 'Rejected' | 'Hold' } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/candidate-joinings');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: JoiningRow[] } = await res.json();
      setRecords(json.data.filter((r) => ['Joining Pending', 'Joining Approval'].includes(r.joiningStatus) || r.approvalStatus === 'Pending'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (values: Record<string, string | number | boolean>) => {
    if (!actionRow) return;
    const res = await fetch(`/api/recruitment/candidate-joinings/${actionRow.row.id}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionRow.action, remarks: values.remarks }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Action failed');
    }
    setActionRow(null);
    fetchData();
  };

  const columns: Column<JoiningRow>[] = [
    { key: 'candidate', label: 'Candidate', render: (r) => `${r.candidate.applicationNo} — ${r.candidate.firstName} ${r.candidate.lastName}` },
    { key: 'department', label: 'Department', render: (r) => r.candidate.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (r) => r.candidate.designation?.name ?? '—' },
    { key: 'joiningDate', label: 'Joining Date', render: (r) => (r.joiningDate ? new Date(r.joiningDate).toLocaleDateString() : '—') },
    { key: 'joiningStatus', label: 'Status', render: (r) => <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>{r.joiningStatus}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Employee Joining Approval</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Joining records awaiting approval before employee creation (BRD §8).</p>
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
        emptyMessage="No joinings pending approval."
        renderRowActions={(row) => (
          <>
            <button onClick={() => setActionRow({ row, action: 'Approved' })} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>Approve</button>
            <button onClick={() => setActionRow({ row, action: 'Hold' })} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#92400e' }}>Hold</button>
            <button onClick={() => setActionRow({ row, action: 'Rejected' })} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>Reject</button>
          </>
        )}
      />

      <FormModal
        title={`${actionRow?.action ?? ''} Joining`}
        fields={actionFields}
        initialValues={{}}
        isOpen={actionRow !== null}
        onClose={() => setActionRow(null)}
        onSubmit={handleAction}
        submitLabel={actionRow?.action ?? 'Submit'}
      />
    </div>
  );
}
