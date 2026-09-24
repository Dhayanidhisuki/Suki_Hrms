/**
 * Employee Self Service — OT Requests. Self-service: always the logged-in
 * user's own employee record, resolved server-side. Two-stage approval
 * (Reporting Manager → HR), same engine as Mis-Punch/Permission.
 *
 * Distinct from /ess/ot-slip (read-only history of already-decided OT,
 * whichever origin) — this is where an employee actually asks to be
 * credited overtime for a date, rather than only ever having it computed
 * automatically from biometric punches.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, Button, PageBreadcrumb, useToast, type Column, type FieldDef } from '@/components/ui';

interface OTRequestRow {
  id: number;
  date: string;
  requestedMinutes: number;
  reason: string;
  status: string;
  managerRejectionReason: string | null;
  hrRejectionReason: string | null;
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

const hrs = (minutes: number) => `${(minutes / 60).toFixed(2).replace(/\.00$/, '')}h`;

export default function OTRequestsPage() {
  const [records, setRecords] = useState<OTRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/ot-request?scope=mine');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to fetch');
      const json: { data: OTRequestRow[] } = await res.json();
      setRecords(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const fields: FieldDef[] = [
    { name: 'date', label: 'Date', type: 'date', required: true, helpText: 'The date you worked the overtime.' },
    { name: 'hours', label: 'Hours', type: 'number', required: true, min: 0.25, step: '0.25', helpText: 'How many hours of OT you are claiming for that date.' },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/ot-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: values.date,
        requestedMinutes: Math.round(Number(values.hours) * 60),
        reason: values.reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
    toast.success('OT request submitted.');
  };

  const columns: Column<OTRequestRow>[] = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'requestedMinutes', label: 'Requested', render: (r) => hrs(r.requestedMinutes) },
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
      key: 'rejectionReason',
      label: 'Rejection Reason',
      render: (r) => r.managerRejectionReason ?? r.hrRejectionReason ?? '—',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'OT Requests' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>OT Requests</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Worked overtime that your punches don&apos;t already show? Claim it here — your Reporting Manager reviews it first, then HR gives final approval.
        </p>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Submit Request</Button>
        </div>

        <DataTable variant="card" columns={columns} data={records} loading={loading} emptyMessage="No OT requests yet." />
      </div>

      <FormModal
        title="Request OT"
        fields={fields}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Request"
      />
    </div>
  );
}
