/**
 * Employee Self Service — On-Duty (OD) Applications. Self-service like
 * Permission Requests: always the logged-in user's own employee record,
 * resolved server-side. Two-stage approval (Reporting Manager → HR).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, useToast, type Column, type FieldDef } from '@/components/ui';

interface OnDutyRow {
  id: number;
  fromDate: string;
  toDate: string;
  location: string;
  purpose: string;
  customerProject: string | null;
  remarks: string | null;
  status: string;
  managerRejectionReason: string | null;
  rejectionReason: string | null;
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

export default function OnDutyPage() {
  const [records, setRecords] = useState<OnDutyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/on-duty?scope=mine');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: OnDutyRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fields: FieldDef[] = [
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date', required: true },
    { name: 'location', label: 'Location', type: 'text', required: true },
    { name: 'purpose', label: 'Purpose', type: 'textarea', required: true },
    { name: 'customerProject', label: 'Customer / Project', type: 'text' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/on-duty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate: values.fromDate,
        toDate: values.toDate,
        location: values.location,
        purpose: values.purpose,
        customerProject: values.customerProject || null,
        remarks: values.remarks || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const columns: Column<OnDutyRow>[] = [
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'location', label: 'Location' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'customerProject', label: 'Customer/Project', render: (r) => r.customerProject ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        );
      },
    },
    {
      key: 'remarks',
      label: 'Notes',
      render: (r) => r.rejectionReason ?? r.managerRejectionReason ?? r.remarks ?? '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            On-Duty (OD) Applications
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Apply when performing official duty outside your normal workplace. Approved days are counted as
            present, not absent.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Apply for On-Duty
        </button>
      </div>

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No On-Duty applications yet." />

      <FormModal
        title="Apply for On-Duty"
        fields={fields}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Application"
      />
    </div>
  );
}
