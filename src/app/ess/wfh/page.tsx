/**
 * Employee Self Service — Work From Home (WFH) Applications. Self-service
 * like On-Duty: always the logged-in user's own employee record, resolved
 * server-side. Two-stage approval (Reporting Manager → HR).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, Button, PageBreadcrumb, useToast, type Column, type FieldDef } from '@/components/ui';

interface WfhRow {
  id: number;
  fromDate: string;
  toDate: string;
  reason: string;
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

export default function WfhPage() {
  const [records, setRecords] = useState<WfhRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/wfh?scope=mine');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: WfhRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const fields: FieldDef[] = [
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date', required: true },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/wfh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate: values.fromDate,
        toDate: values.toDate,
        reason: values.reason,
        remarks: values.remarks || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
    toast.success('Work from home request submitted successfully.');
  };

  const columns: Column<WfhRow>[] = [
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'reason', label: 'Reason' },
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
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'WFH Requests' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>WFH Requests</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Apply to work remotely for a date range. Approved days are counted as present.
        </p>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Submit Request</Button>
        </div>

        <DataTable variant="card" columns={columns} data={records} loading={loading} emptyMessage="No WFH applications yet." />
      </div>

      <FormModal
        title="Apply for Work From Home"
        fields={fields}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Application"
      />
    </div>
  );
}
