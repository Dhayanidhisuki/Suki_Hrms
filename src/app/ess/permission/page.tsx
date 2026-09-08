/**
 * Employee Self Service — Permission Requests (short leave, in hours).
 * Self-service like Mis-Punch Requests: always the logged-in user's own
 * employee record, resolved server-side. Single-stage approval — HR
 * reviews and approves, no Reporting Manager step.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, type Column, type FieldDef } from '@/components/ui';

interface PermissionRow {
  id: number;
  date: string;
  fromTime: string;
  toTime: string;
  hours: number;
  reason: string | null;
  status: string;
  exceedsAllowance: boolean;
  excessHours: number;
  rejectionReason: string | null;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef9c3', fg: '#854d0e' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
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

export default function PermissionRequestsPage() {
  const [records, setRecords] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/permission?scope=mine');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: PermissionRow[] } = await res.json();
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
    { name: 'fromTime', label: 'From', type: 'text', placeholder: 'e.g. 2026-09-05T10:00' },
    { name: 'toTime', label: 'To', type: 'text', placeholder: 'e.g. 2026-09-05T12:00' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/workforce/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: values.date, fromTime: values.fromTime, toTime: values.toTime, reason: values.reason || null }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const columns: Column<PermissionRow>[] = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'from', label: 'From', render: (r) => formatWallClockTime(r.fromTime) },
    { key: 'to', label: 'To', render: (r) => formatWallClockTime(r.toTime) },
    { key: 'hours', label: 'Hours', render: (r) => Number(r.hours).toFixed(2) },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {r.status}
          </span>
        );
      },
    },
    {
      key: 'allowance',
      label: 'Allowance',
      render: (r) => (r.status === 'approved' && r.exceedsAllowance ? `Exceeds by ${Number(r.excessHours).toFixed(2)}h` : r.rejectionReason ?? '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Permission Requests
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Short leave during the day, in hours. Requests beyond your monthly free allowance are flagged for HR to
            handle as a Loss of Pay adjustment.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Request Permission
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No permission requests yet." />

      <FormModal
        title="Request Permission"
        fields={fields}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Request"
      />
    </div>
  );
}
