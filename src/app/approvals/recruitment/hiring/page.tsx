/**
 * Hiring Approval — BRD §16.3.3.
 * Lists Job Postings in 'Pending' status awaiting HR/management approval.
 * Approve → status 'Open' (visible to applicants).
 * Reject  → status 'Rejected' (back to requisitioner).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, FormModal, type Column, type FieldDef } from '@/components/ui';

interface JobPostingRow {
  id: number;
  title: string;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  vacancies: number;
  employmentType: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  closingDate: string | null;
  status: string;
  createdAt: string;
}

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason', type: 'textarea', required: true }];

export default function HiringApprovalPage() {
  const [records, setRecords] = useState<JobPostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveRow, setApproveRow] = useState<JobPostingRow | null>(null);
  const [rejectRow, setRejectRow] = useState<JobPostingRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/job-postings?status=Pending');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: JobPostingRow[] } = await res.json();
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
    const res = await fetch(`/api/recruitment/job-postings/${approveRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Open' }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? 'Approve failed');
      return;
    }
    setApproveRow(null);
    fetchData();
  };

  const columns: Column<JobPostingRow>[] = [
    { key: 'title', label: 'Job Title' },
    { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (r) => r.designation?.name ?? '—' },
    { key: 'vacancies', label: 'Vacancies' },
    { key: 'employmentType', label: 'Type', render: (r) => r.employmentType ?? '—' },
    { key: 'salary', label: 'Salary Range', render: (r) => (r.minSalary && r.maxSalary ? `₹${r.minSalary.toLocaleString()} – ₹${r.maxSalary.toLocaleString()}` : '—') },
    { key: 'closingDate', label: 'Closing', render: (r) => (r.closingDate ? new Date(r.closingDate).toLocaleDateString() : '—') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Hiring Approval</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Job postings awaiting approval before being published (BRD §16.3.3).</p>
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
        emptyMessage="No job postings pending approval."
        renderRowActions={(row) => (
          <>
            <button onClick={() => setApproveRow(row)} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>Approve</button>
            <button onClick={() => setRejectRow(row)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>Reject</button>
          </>
        )}
      />

      <ConfirmDialog
        title="Approve Job Posting"
        message={`Approve "${approveRow?.title}"? This publishes the posting for applicants.`}
        confirmLabel="Approve"
        isOpen={approveRow !== null}
        onConfirm={handleApprove}
        onClose={() => setApproveRow(null)}
      />

      <FormModal
        title="Reject Job Posting"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectRow !== null}
        onClose={() => setRejectRow(null)}
        onSubmit={async (values) => {
          if (!rejectRow) return;
          const res = await fetch(`/api/recruitment/job-postings/${rejectRow.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Rejected', remarks: values.rejectionReason }),
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
