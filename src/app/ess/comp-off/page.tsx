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
import { DataTable, Button, GaugeCard, PageBreadcrumb, useToast, type Column } from '@/components/ui';

interface CompOffRow {
  id: number;
  workedDate: string;
  requestedDate: string;
  reason: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface CompOffBalance {
  available: number;
  earned: number;
  used: number;
  expired: number;
  encashed: number;
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
  const [balance, setBalance] = useState<CompOffBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/comp-off-request');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to fetch');
      const json: { data: CompOffRow[]; balance: CompOffBalance | null } = await res.json();
      setRecords(json.data ?? []);
      setBalance(json.balance ?? null);
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
    toast.success('Comp-off request submitted successfully.');
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
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'Comp-Off Requests' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Comp-Off Requests</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Worked a weekly off or a holiday? Claim it back as a comp-off day, once that day&apos;s overtime is approved.
        </p>
      </div>

      {/* Same balance shown on the Leave Requests form when "Compensatory
          Off" is picked there — surfaced here too, since this is the page
          an employee actually lands on to check their comp-off status. */}
      {balance && balance.earned > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GaugeCard label="Comp-Off" value={balance.available} max={Math.max(balance.earned, balance.available)} deltaPct={null} tone="var(--success)" />
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Earned</div>
              <div className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{balance.earned}</div>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Used</div>
              <div className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{balance.used}</div>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: balance.expired > 0 ? '#fcd34d' : 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Expired</div>
              <div className="mt-1 text-xl font-bold" style={{ color: balance.expired > 0 ? '#854d0e' : 'var(--text-primary)' }}>{balance.expired}</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Submit Request</Button>
        </div>

        <DataTable variant="card" columns={columns} data={records} loading={loading} emptyMessage="No comp-off requests yet." />
      </div>

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
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(EMPTY_FORM);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workedDate || !form.requestedDate) {
      toast.error('Both the worked date and the comp-off date are required.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (form.workedDate > today) {
      toast.error('The worked date cannot be in the future.');
      return;
    }
    if (form.requestedDate <= form.workedDate) {
      toast.error('The comp-off date must be after the day you worked.');
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
