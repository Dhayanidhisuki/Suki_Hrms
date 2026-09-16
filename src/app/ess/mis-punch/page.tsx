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
import { DataTable, type Column } from '@/components/ui';

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

/** The biometric-recorded day, as /api/workforce/my-attendance returns it. */
interface RecordedDay {
  date: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
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

/** Punch times are stored as wall clock in UTC, so read them back with UTC getters. */
function toTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
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

  const handleSubmit = async (form: { date: string; inTime: string; outTime: string; reason: string }) => {
    const res = await fetch('/api/workforce/mispunch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        // The API wants wall-clock YYYY-MM-DDTHH:mm, composed from the picked date.
        requestedInTime: form.inTime ? `${form.date}T${form.inTime}` : null,
        requestedOutTime: form.outTime ? `${form.date}T${form.outTime}` : null,
        reason: form.reason,
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

      <MisPunchModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
    </div>
  );
}

const EMPTY_FORM = { date: '', inTime: '', outTime: '', reason: '' };

function MisPunchModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: typeof EMPTY_FORM) => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [recorded, setRecorded] = useState<RecordedDay | null>(null);
  const [lookedUp, setLookedUp] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setRecorded(null);
      setLookedUp(false);
      setError(null);
    }
  }, [isOpen]);

  // Picking a date pulls that day's recorded punches and seeds the time inputs,
  // so the employee only edits the punch that is actually wrong.
  const pickDate = async (date: string) => {
    setForm({ ...form, date, inTime: '', outTime: '' });
    setRecorded(null);
    setLookedUp(false);
    if (!date) return;

    setLookingUp(true);
    setError(null);
    try {
      const [year, month] = date.split('-');
      const res = await fetch(`/api/workforce/my-attendance?year=${Number(year)}&month=${Number(month)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load that day');
      const json: { data: RecordedDay[] } = await res.json();
      const day = (json.data ?? []).find((d) => d.date.slice(0, 10) === date) ?? null;
      setRecorded(day);
      setLookedUp(true);
      if (day) {
        setForm((prev) => ({
          ...prev,
          inTime: toTimeInput(day.inTime),
          outTime: toTimeInput(day.outTime),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that day');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.reason.trim()) {
      setError('Date and reason are required.');
      return;
    }
    if (!form.inTime && !form.outTime) {
      setError('Enter at least one of In Time or Out Time.');
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

  const inputStyle = {
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
  };
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-y-auto rounded-xl shadow-2xl max-h-[90vh]"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Request Mis-Punch Correction
          </h2>
          <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>
              Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => pickDate(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          {(lookingUp || lookedUp) && (
            <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(59,130,246,0.06)' }}>
              {lookingUp ? (
                <span style={{ color: 'var(--foreground-muted)' }}>Loading recorded punches…</span>
              ) : recorded ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span style={{ color: 'var(--foreground-muted)' }}>Biometric record:</span>
                  <span style={{ color: 'var(--foreground)' }}>
                    In <strong>{formatWallClockTime(recorded.inTime)}</strong>
                  </span>
                  <span style={{ color: 'var(--foreground)' }}>
                    Out <strong>{formatWallClockTime(recorded.outTime)}</strong>
                  </span>
                  <span style={{ color: 'var(--foreground-muted)' }}>({recorded.status})</span>
                </div>
              ) : (
                <span style={{ color: 'var(--foreground-muted)' }}>No attendance recorded for this date.</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--foreground)' }}>Correct In Time</label>
              <input
                type="time"
                value={form.inTime}
                onChange={(e) => setForm({ ...form, inTime: e.target.value })}
                disabled={!form.date}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--foreground)' }}>Correct Out Time</label>
              <input
                type="time"
                value={form.outTime}
                onChange={(e) => setForm({ ...form, outTime: e.target.value })}
                disabled={!form.date}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Prefilled from the biometric record where available — change only the punch that is wrong.
          </p>

          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>
              Reason <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
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
