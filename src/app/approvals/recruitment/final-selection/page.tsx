/**
 * Final Selection Approval — BRD §5.14, §16.3.3.
 * Lists Draft OfferLetters (final selection proposals) awaiting approval.
 * Approve → status becomes 'Pending Offer' (ready for offer letter generation).
 * Reject  → status becomes 'Rejected'.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface SelectionRow {
  id: number;
  offerNo: string;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string; department?: { name: string } | null; designation?: { name: string } | null };
  proposedSalary: number | null;
  employmentType: string | null;
  joiningDate: string | null;
  remarks: string | null;
  createdAt: string;
}

const rejectFields: FieldDef[] = [{ name: 'remarks', label: 'Rejection Reason', type: 'textarea', required: true }];

export default function FinalSelectionApprovalPage() {
  const [records, setRecords] = useState<SelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveRow, setApproveRow] = useState<SelectionRow | null>(null);
  const [rejectRow, setRejectRow] = useState<SelectionRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/final-selections');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: SelectionRow[] } = await res.json();
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

  const handleApprove = async () => {
    if (!approveRow) return;
    const res = await fetch(`/api/recruitment/offer-letters/${approveRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Pending Offer' }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? 'Approve failed');
      return;
    }
    setApproveRow(null);
    fetchData();
  };

  const columns: Column<SelectionRow>[] = [
    { key: 'offerNo', label: 'Proposal No' },
    { key: 'candidate', label: 'Candidate', render: (r) => `${r.candidate.applicationNo} — ${r.candidate.firstName} ${r.candidate.lastName}` },
    { key: 'department', label: 'Department', render: (r) => r.candidate.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (r) => r.candidate.designation?.name ?? '—' },
    { key: 'proposedSalary', label: 'Proposed CTC', render: (r) => (r.proposedSalary ? `₹${r.proposedSalary.toLocaleString()}` : '—') },
    { key: 'employmentType', label: 'Type', render: (r) => r.employmentType ?? '—' },
    { key: 'joiningDate', label: 'Joining', render: (r) => (r.joiningDate ? new Date(r.joiningDate).toLocaleDateString() : '—') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Final Selection Approval</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Salary proposals awaiting approval before offer letter generation (BRD §5.14).</p>
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
        emptyMessage="No final selection proposals pending."
        renderRowActions={(row) => (
          <>
            <button onClick={() => setApproveRow(row)} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>Approve</button>
            <button onClick={() => setRejectRow(row)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>Reject</button>
          </>
        )}
      />

      <ConfirmDialog
        title="Approve Final Selection"
        message={`Approve ${approveRow?.candidate.firstName} ${approveRow?.candidate.lastName}'s proposal? This enables offer letter generation.`}
        confirmLabel="Approve"
        isOpen={approveRow !== null}
        onConfirm={handleApprove}
        onClose={() => setApproveRow(null)}
      />

      <FormModal
        title="Reject Final Selection"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectRow !== null}
        onClose={() => setRejectRow(null)}
        onSubmit={async (values) => {
          if (!rejectRow) return;
          const res = await fetch(`/api/recruitment/offer-letters/${rejectRow.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Rejected', remarks: values.remarks }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Reject failed');
          }
          setRejectRow(null);
          fetchData();
        }}
        submitLabel="Reject"
      />
    </div>
  );
}
