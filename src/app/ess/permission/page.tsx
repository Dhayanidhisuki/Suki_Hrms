/**
 * Employee Self Service — Permission Requests (short leave, in hours).
 * Self-service like Mis-Punch Requests: always the logged-in user's own
 * employee record, resolved server-side. Two-stage approval (Reporting
 * Manager → HR), same engine as Mis-Punch/On-Duty/WFH.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, Button, GaugeCard, PageBreadcrumb, useToast, type Column } from '@/components/ui';

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

function formatWallClockTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

interface Allowance {
  freeHoursPerMonth: number;
  approvedHours: number;
  pendingHours: number;
  usedHours: number;
  remainingHours: number;
  month: string;
}

const hrs = (n: number) => `${Number(n).toFixed(2).replace(/\.00$/, '')}h`;

/**
 * fromTime/toTime as HH:mm → decimal hours, rounded the same way the API
 * rounds it server-side (`/api/workforce/permission` POST) so what the
 * employee sees before submitting is exactly what gets saved, not an
 * approximation that could disagree with the real figure.
 */
function computeHours(fromTime: string, toTime: string): number | null {
  if (!fromTime || !toTime) return null;
  const [fh, fm] = fromTime.split(':').map(Number);
  const [th, tm] = toTime.split(':').map(Number);
  const minutes = th * 60 + tm - (fh * 60 + fm);
  if (minutes <= 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

export default function PermissionRequestsPage() {
  const [records, setRecords] = useState<PermissionRow[]>([]);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/permission?scope=mine');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: PermissionRow[]; allowance?: Allowance } = await res.json();
      setRecords(json.data);
      setAllowance(json.allowance ?? null);
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

  const handleSubmit = async (form: { date: string; fromTime: string; toTime: string; reason: string }) => {
    const res = await fetch('/api/workforce/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        // API wants full wall-clock YYYY-MM-DDTHH:mm, composed from the picked date.
        fromTime: `${form.date}T${form.fromTime}`,
        toTime: `${form.date}T${form.toTime}`,
        reason: form.reason || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
    toast.success('Permission requested successfully.');
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
            {STATUS_LABEL[r.status] ?? r.status}
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
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'Permission Requests' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Permission Requests</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Short leave during the day, in hours. Use your monthly allowance in any split you like — 30 minutes one
          day, an hour another. Hours beyond it are flagged for HR, not deducted automatically.
        </p>
      </div>

      {allowance && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GaugeCard
            label={`Permission (${new Date(`${allowance.month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })})`}
            value={Math.round(allowance.remainingHours)}
            max={allowance.freeHoursPerMonth}
            deltaPct={null}
            tone="var(--info)"
          />
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Monthly Allowance</div>
              <div className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{hrs(allowance.freeHoursPerMonth)}</div>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Approved</div>
              <div className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{hrs(allowance.approvedHours)}</div>
            </div>
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: allowance.remainingHours > 0 ? 'var(--border-main)' : '#fcd34d', backgroundColor: 'var(--bg-card)' }}
            >
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Awaiting Approval</div>
              <div className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{hrs(allowance.pendingHours)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Submit Request</Button>
        </div>

        <DataTable variant="card" columns={columns} data={records} loading={loading} emptyMessage="No permission requests yet." />
      </div>

      <PermissionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        remainingHours={allowance?.remainingHours ?? null}
      />
    </div>
  );
}

const EMPTY_FORM = { date: '', fromTime: '', toTime: '', reason: '' };

function PermissionModal({
  isOpen,
  onClose,
  onSubmit,
  remainingHours,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: typeof EMPTY_FORM) => Promise<void>;
  /** The month's remaining allowance, so an over-budget pick can be flagged before submit. */
  remainingHours: number | null;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setForm(EMPTY_FORM);
  }, [isOpen]);

  const computedHours = computeHours(form.fromTime, form.toTime);
  const exceedsAllowance = computedHours !== null && remainingHours !== null && computedHours > remainingHours;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.fromTime || !form.toTime || !form.reason.trim()) {
      toast.error('Date, from time, to time, and reason are required.');
      return;
    }
    if (computedHours === null) {
      toast.error('To time must be after from time.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
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
            Request Permission
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
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              max={new Date().toISOString().slice(0, 10)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: 'var(--foreground)' }}>
                From Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="time"
                value={form.fromTime}
                onChange={(e) => setForm({ ...form, fromTime: e.target.value })}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--foreground)' }}>
                To Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="time"
                value={form.toTime}
                onChange={(e) => setForm({ ...form, toTime: e.target.value })}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Duration is derived, never typed — it updates the instant either
              time is picked, using the exact same rounding the API applies,
              so this can never disagree with what actually gets saved. */}
          {form.fromTime && form.toTime && (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: exceedsAllowance ? '#fcd34d' : 'var(--border)',
                backgroundColor: exceedsAllowance ? 'rgba(250,204,21,0.10)' : 'rgba(59,130,246,0.06)',
              }}
            >
              {computedHours === null ? (
                <span style={{ color: '#dc2626' }}>To time must be after from time.</span>
              ) : (
                <>
                  <span style={{ color: 'var(--foreground-muted)' }}>Duration: </span>
                  <strong style={{ color: 'var(--foreground)' }}>{hrs(computedHours)}</strong>
                  {exceedsAllowance && (
                    <span style={{ color: '#854d0e' }}>
                      {' '}
                      — exceeds your remaining allowance of {hrs(remainingHours!)}; it will be refused at submission.
                    </span>
                  )}
                </>
              )}
            </div>
          )}

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
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
