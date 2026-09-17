/**
 * Employee Self Service — Comp-Off Requests. Self-service: employeeId is
 * resolved from the session by /api/workforce/comp-off-request, never sent
 * by the client; the GET scopes itself to the caller unless they hold an
 * HR grant.
 *
 * Comp-off is EARNED by working a weekly off or holiday and having that
 * day's OT approved — the API rejects a claim whose worked date fails
 * either test. This page only claims a day already earned; it cannot
 * create the entitlement.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface CompOffRow {
  id: number;
  workedDate: string;
  requestedDate: string;
  reason: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef9c3', fg: '#854d0e' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'UTC' });

export default function EssCompOffPage() {
  const [records, setRecords] = useState<CompOffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/comp-off-request');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to fetch');
      const json: { data: CompOffRow[] } = await res.json();
      setRecords(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async (form: { workedDate: string; requestedDate: string; reason: string }) => {
    const res = await fetch('/api/workforce/comp-off-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workedDate: form.workedDate,
        requestedDate: form.requestedDate,
        reason: form.reason || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Save failed');
    }
    await fetchData();
  };

  const columns: Column<CompOffRow>[] = [
    { key: 'workedDate', label: 'Worked On', render: (r) => fmtDate(r.workedDate) },
    { key: 'requestedDate', label: 'Comp-Off Date', render: (r) => fmtDate(r.requestedDate) },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
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
    { key: 'rejectionReason', label: 'Rejection Reason', render: (r) => r.rejectionReason ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Comp-Off Requests</h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Worked a weekly off or a holiday? Claim it back as a comp-off day, once that day&apos;s overtime is approved.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Request Comp-Off
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No comp-off requests yet." />

      <CompOffModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
    </div>
  );
}

const EMPTY_FORM = { workedDate: '', requestedDate: '', reason: '' };

function CompOffModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: typeof EMPTY_FORM) => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workedDate || !form.requestedDate) {
      setError('Both the worked date and the comp-off date are required.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (form.workedDate > today) {
      setError('The worked date cannot be in the future.');
      return;
    }
    if (form.requestedDate <= form.workedDate) {
      setError('The comp-off date must be after the day you worked.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-y-auto rounded-xl shadow-2xl max-h-[90vh]"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Request Comp-Off</h2>
          <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* The API rejects a worked date that was not a weekly off or holiday,
              or whose OT is not yet approved. Saying so up front avoids a
              round-trip that reads like a system error. */}
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(59,130,246,0.06)', color: 'var(--foreground-muted)' }}>
            The day you worked must be a <strong>weekly off or holiday</strong>, and its <strong>overtime must already be approved</strong>.
            If OT approval is still pending, this request will be rejected — wait for it, then claim.
          </div>

          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>
              Date You Worked <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              value={form.workedDate}
              onChange={(e) => setForm({ ...form, workedDate: e.target.value })}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>
              Comp-Off Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              value={form.requestedDate}
              onChange={(e) => setForm({ ...form, requestedDate: e.target.value })}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>The day you want to take off instead.</p>
          </div>

          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Saving…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
