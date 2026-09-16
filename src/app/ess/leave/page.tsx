/**
 * Employee Self Service — Leave Management. Apply for leave, view balances
 * per leave type, and see/cancel application history. Self-service:
 * always the logged-in user's own employee record, resolved server-side.
 * Two-stage approval (Reporting Manager → HR), same engine as the HR-side
 * Leave Approval page — this is just the self-scoped apply/view surface.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface LeaveType {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface LeaveBalanceRow {
  id: number;
  year: number;
  openingBalance: string;
  accrued: string;
  availed: string;
  closingBalance: string;
  leaveMaster: { id: number; code: string; name: string };
}

interface LeaveApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  managerRejectionReason: string | null;
  rejectionReason: string | null;
  leaveMaster: { code: string; name: string };
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#f1f5f9', fg: '#475569' },
};

const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const CANCELLABLE = new Set(['pending_manager', 'pending_hr', 'approved']);

export default function EssLeavePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [applications, setApplications] = useState<LeaveApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ leaveMasterId: '', fromDate: '', toDate: '', isHalfDay: false, reason: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, leaveRes] = await Promise.all([
        fetch('/api/workforce/my-leave/types'),
        fetch(`/api/workforce/my-leave?year=${year}`),
      ]);
      if (!typesRes.ok) throw new Error((await typesRes.json().catch(() => ({}))).error ?? 'Failed to load leave types');
      if (!leaveRes.ok) throw new Error((await leaveRes.json().catch(() => ({}))).error ?? 'Failed to load leave data');
      const typesJson = await typesRes.json();
      const leaveJson = await leaveRes.json();
      setTypes(typesJson.data ?? []);
      setBalances(leaveJson.balances ?? []);
      setApplications(leaveJson.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function computeDays(fromDate: string, toDate: string, isHalfDay: boolean): number {
    if (!fromDate || !toDate) return 0;
    if (isHalfDay) return 0.5;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  }

  async function applyForLeave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const numberOfDays = computeDays(form.fromDate, form.toDate, form.isHalfDay);
      const res = await fetch('/api/workforce/my-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveMasterId: form.leaveMasterId,
          fromDate: form.fromDate,
          toDate: form.isHalfDay ? form.fromDate : form.toDate,
          numberOfDays,
          isHalfDay: form.isHalfDay,
          reason: form.reason || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to submit application');
      }
      setForm({ leaveMasterId: '', fromDate: '', toDate: '', isHalfDay: false, reason: '' });
      setMessage('Leave application submitted for approval.');
      await fetchAll();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelApplication(id: number) {
    if (!confirm('Cancel this leave application?')) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/workforce/my-leave/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to cancel');
      }
      setMessage('Leave application cancelled.');
      await fetchAll();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const previewDays = computeDays(form.fromDate, form.toDate, form.isHalfDay);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Leave</h1>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-24 rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <>
          <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Leave Balance ({year})</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Leave Type</th>
                  <th className="px-4 py-2">Opening</th>
                  <th className="px-4 py-2">Accrued</th>
                  <th className="px-4 py-2">Availed</th>
                  <th className="px-4 py-2">Closing Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No leave balance set up for {year} yet.</td></tr>
                )}
                {balances.map((b) => (
                  <tr key={b.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2 font-medium">{b.leaveMaster.name}</td>
                    <td className="px-4 py-2">{Number(b.openingBalance).toFixed(1)}</td>
                    <td className="px-4 py-2">{Number(b.accrued).toFixed(1)}</td>
                    <td className="px-4 py-2">{Number(b.availed).toFixed(1)}</td>
                    <td className="px-4 py-2 font-semibold">{Number(b.closingBalance).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form onSubmit={applyForLeave} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Apply for Leave</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                className={inputClass}
                style={inputStyle}
                value={form.leaveMasterId}
                onChange={(e) => setForm({ ...form, leaveMasterId: e.target.value })}
                required
              >
                <option value="">Select leave type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                style={inputStyle}
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                required
              />
              {!form.isHalfDay && (
                <input
                  className={inputClass}
                  style={inputStyle}
                  type="date"
                  value={form.toDate}
                  onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                  required
                />
              )}
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={form.isHalfDay}
                  onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked, toDate: e.target.checked ? form.fromDate : form.toDate })}
                />
                Half day
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Reason (optional)"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            {previewDays > 0 && (
              <div className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {previewDays} day{previewDays !== 1 ? 's' : ''} will be requested.
              </div>
            )}
            <button type="submit" disabled={submitting} className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>

          <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Leave History</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2">Days</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Notes</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No leave applications for {year}.</td></tr>
                )}
                {applications.map((a) => {
                  const tone = STATUS_TONE[a.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
                  return (
                    <tr key={a.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2 font-medium">{a.leaveMaster.name}</td>
                      <td className="px-4 py-2">{new Date(a.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</td>
                      <td className="px-4 py-2">{new Date(a.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</td>
                      <td className="px-4 py-2">{Number(a.numberOfDays).toFixed(1)}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{STATUS_LABEL[a.status] ?? a.status}</span>
                      </td>
                      <td className="px-4 py-2">{a.rejectionReason ?? a.managerRejectionReason ?? a.reason ?? '—'}</td>
                      <td className="px-4 py-2 text-right">
                        {CANCELLABLE.has(a.status) && (
                          <button onClick={() => cancelApplication(a.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
