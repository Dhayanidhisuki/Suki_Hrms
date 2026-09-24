/**
 * Employee Self Service — Leave Encashment. Self-service: employeeId is
 * resolved from the session by /api/workforce/my-leave-encashment.
 *
 * Amounts shown are ESTIMATES computed from the company's encashment config
 * and the employee's last payroll line. Payroll settles the final figure at
 * payout, so the page never presents the estimate as what will be paid.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, Button, PageBreadcrumb, useToast, type Column } from '@/components/ui';

interface EncashRow {
  id: number;
  leaveMasterId: number;
  leaveYear: string;
  daysRequested: number;
  daysApproved: number | null;
  estimatedAmount: number | null;
  finalAmount: number | null;
  status: string;
  remark: string | null;
  requestedAt: string;
}

interface Bucket {
  leaveMasterId: number;
  code: string;
  name: string;
  available: number;
}

interface Eligibility {
  configured: boolean;
  encashable: Bucket[];
  totalAvailableDays: number;
  maxEncashableDays: number | null;
  perDaySalary: number;
  calculationBasis: string | null;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  SUBMITTED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dbeafe', fg: '#1e40af' },
  QUEUED_FOR_PAYROLL: { bg: '#dbeafe', fg: '#1e40af' },
  PAID: { bg: '#dcfce7', fg: '#166534' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  CANCELLED: { bg: '#f1f5f9', fg: '#475569' },
  LAPSED_ON_EXIT: { bg: '#f1f5f9', fg: '#475569' },
  DRAFT: { bg: '#f1f5f9', fg: '#475569' },
};
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  QUEUED_FOR_PAYROLL: 'Queued for Payroll',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  LAPSED_ON_EXIT: 'Lapsed on Exit',
  DRAFT: 'Draft',
};

const money = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function EssLeaveEncashmentPage() {
  const [records, setRecords] = useState<EncashRow[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/my-leave-encashment');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to fetch');
      const json: { data: EncashRow[]; eligibility: Eligibility } = await res.json();
      setRecords(json.data ?? []);
      setEligibility(json.eligibility);
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

  const handleSubmit = async (form: { leaveMasterId: string; daysRequested: string; remark: string }) => {
    const res = await fetch('/api/workforce/my-leave-encashment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaveMasterId: Number(form.leaveMasterId),
        daysRequested: Number(form.daysRequested),
        remark: form.remark || undefined,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
    await fetchData();
    toast.success('Leave encashment request submitted successfully.');
  };

  const columns: Column<EncashRow>[] = [
    { key: 'leaveYear', label: 'Leave Year' },
    { key: 'daysRequested', label: 'Days', render: (r) => r.daysRequested.toFixed(1) },
    { key: 'daysApproved', label: 'Approved', render: (r) => (r.daysApproved === null ? '—' : r.daysApproved.toFixed(1)) },
    { key: 'estimatedAmount', label: 'Estimated', render: (r) => money(r.estimatedAmount) },
    { key: 'finalAmount', label: 'Paid', render: (r) => money(r.finalAmount) },
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
  ];

  const canApply = eligibility?.configured && eligibility.encashable.some((b) => b.available > 0);

  return (
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'Leave Encashment' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Leave Encashment</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Convert unused leave into payment. HR reviews each request and payroll settles the final amount.
        </p>
      </div>

      {!loading && eligibility && !eligibility.configured && (
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          Leave encashment is not configured for your company yet — contact HR.
        </div>
      )}

      {!loading && eligibility?.configured && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Encashable Days</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{eligibility.totalAvailableDays.toFixed(1)}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Annual Limit</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{eligibility.maxEncashableDays ?? '—'}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Per Day (est.)</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{money(eligibility.perDaySalary)}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Basis</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{eligibility.calculationBasis ?? '—'}</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)} disabled={!canApply}>Submit Request</Button>
        </div>

        <DataTable variant="card" columns={columns} data={records} loading={loading} emptyMessage="No encashment requests yet." />
      </div>

      {eligibility && (
        <EncashModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          eligibility={eligibility}
        />
      )}
    </div>
  );
}

const EMPTY_FORM = { leaveMasterId: '', daysRequested: '', remark: '' };

function EncashModal({
  isOpen,
  onClose,
  onSubmit,
  eligibility,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: typeof EMPTY_FORM) => Promise<void>;
  eligibility: Eligibility;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(EMPTY_FORM);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selected = eligibility.encashable.find((b) => String(b.leaveMasterId) === form.leaveMasterId);
  const days = Number(form.daysRequested);
  const estimate = Number.isFinite(days) && days > 0 ? days * eligibility.perDaySalary : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leaveMasterId || !form.daysRequested) {
      toast.error('Choose a leave type and the number of days.');
      return;
    }
    if (!(days > 0)) {
      toast.error('Days must be greater than zero.');
      return;
    }
    if (selected && days > selected.available) {
      toast.error(`You have only ${selected.available} day(s) of ${selected.name} available.`);
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
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Request Leave Encashment</h2>
          <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>
              Leave Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={form.leaveMasterId}
              onChange={(e) => setForm({ ...form, leaveMasterId: e.target.value })}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            >
              <option value="">Select…</option>
              {eligibility.encashable.map((b) => (
                <option key={b.leaveMasterId} value={b.leaveMasterId} disabled={b.available <= 0}>
                  {b.name} — {b.available.toFixed(1)} day(s) available
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>
              Days to Encash <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              max={selected?.available ?? undefined}
              value={form.daysRequested}
              onChange={(e) => setForm({ ...form, daysRequested: e.target.value })}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
            {estimate > 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Estimated <strong>{money(estimate)}</strong> at {money(eligibility.perDaySalary)}/day.
                Payroll settles the final amount — this is an estimate only.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Remark</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
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
              {submitting ? 'Saving…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
