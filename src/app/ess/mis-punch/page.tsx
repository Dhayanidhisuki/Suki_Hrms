/**
 * Employee Self Service — Mis-Punch Requests. Self-service: the request is
 * always for the logged-in user's own employee record (resolved server-side
 * from the session, see /api/workforce/mispunch), never a picker of "which
 * employee." Two-stage approval (Reporting Manager, then HR) — this page
 * only shows status, the actual approve/reject actions live on
 * /approvals/workforce/mispunch.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface MispunchRow {
  id: number;
  date: string;
  requestedInTime: string | null;
  requestedOutTime: string | null;
  reason: string;
  status: string;
  managerRejectionReason: string | null;
  hrRejectionReason: string | null;
  appliedAt: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#fef9c3', fg: '#854d0e' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};
const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
};

function formatWallClockTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function MisPunchRequestsPage() {
  const [records, setRecords] = useState<MispunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/mispunch?scope=mine');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: MispunchRow[] } = await res.json();
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

  const fields: FieldDef[] = [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'requestedInTime', label: 'Correct In Time', type: 'text', placeholder: 'e.g. 2026-09-05T09:00' },
    { name: 'requestedOutTime', label: 'Correct Out Time', type: 'text', placeholder: 'e.g. 2026-09-05T18:00' },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/mispunch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: values.date,
        requestedInTime: values.requestedInTime || null,
        requestedOutTime: values.requestedOutTime || null,
        reason: values.reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const columns: Column<MispunchRow>[] = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'requestedInTime', label: 'Requested In', render: (r) => formatWallClockTime(r.requestedInTime) },
    { key: 'requestedOutTime', label: 'Requested Out', render: (r) => formatWallClockTime(r.requestedOutTime) },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Mis-Punch Requests
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Missed or wrong in/out punch? Request a correction — your Reporting Manager reviews it first, then HR gives final approval.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Request Correction
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No mis-punch requests yet." />

      <FormModal
        title="Request Mis-Punch Correction"
        fields={fields}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Request"
      />
    </div>
  );
}
