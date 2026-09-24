/**
 * Employee Self Service — Leave Management. Apply for leave, view balances
 * per leave type, and see/cancel application history. Self-service:
 * always the logged-in user's own employee record, resolved server-side.
 * Two-stage approval (Reporting Manager → HR), same engine as the HR-side
 * Leave Approval page — this is just the self-scoped apply/view surface.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast, useConfirm } from '@/components/ui';
import { handleExport } from '@/lib/export-utils';

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
  const { confirm } = useConfirm();
  const [year, setYear] = useState(new Date().getFullYear());
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [applications, setApplications] = useState<LeaveApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({ leaveMasterId: '', fromDate: '', toDate: '', isHalfDay: false, reason: '' });
  const [compOffModalOpen, setCompOffModalOpen] = useState(false);
  const [compOffWorkedDate, setCompOffWorkedDate] = useState('');
  const [compOffLeaveDate, setCompOffLeaveDate] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
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
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year, toast]);

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
      toast.success('Leave application submitted for approval.');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelApplication(id: number) {
    if (
      !(await confirm({
        title: 'Cancel this leave application?',
        message: 'The application will be withdrawn from the approval queue.',
        confirmLabel: 'Cancel application',
        cancelLabel: 'Keep it',
        tone: 'danger',
      }))
    )
      return;
    try {
      const res = await fetch(`/api/workforce/my-leave/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to cancel');
      }
      toast.success('Leave application cancelled.');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  function exportLeaveData(format: 'csv' | 'excel' | 'pdf') {
    const exportData = applications.map(a => ({
      'Leave Type': a.leaveMaster.name,
      'From Date': new Date(a.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
      'To Date': new Date(a.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }),
      'Days': Number(a.numberOfDays).toFixed(1),
      'Half Day': a.isHalfDay ? 'Yes' : 'No',
      'Status': STATUS_LABEL[a.status] ?? a.status,
      'Reason': a.reason ?? '',
      'Rejection Reason': a.rejectionReason ?? a.managerRejectionReason ?? '',
    }));

    handleExport({
      filename: `leave-applications_${year}`,
      data: exportData,
      format,
      title: `Leave Applications - ${year}`,
    });
  }

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const previewDays = computeDays(form.fromDate, form.toDate, form.isHalfDay);
  const selectedType = types.find((t) => String(t.id) === form.leaveMasterId);
  const isCompOff = selectedType?.code === 'COMPOFF';
  const compOffBalance = balances.find((b) => b.leaveMaster.code === 'COMPOFF');
  const compOffAvailable = compOffBalance ? Number(compOffBalance.closingBalance) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Leave</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportLeaveData('csv')}
            disabled={applications.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            title="Download as CSV"
          >
            CSV
          </button>
          <button
            onClick={() => exportLeaveData('excel')}
            disabled={applications.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            title="Download as Excel"
          >
            Excel
          </button>
          <button
            onClick={() => exportLeaveData('pdf')}
            disabled={applications.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            title="Download as PDF"
          >
            PDF
          </button>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </div>
      </div>

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
                onChange={(e) => {
                  const value = e.target.value;
                  const chosen = types.find((t) => String(t.id) === value);
                  setForm({ ...form, leaveMasterId: value, fromDate: '', toDate: '' });
                  if (chosen?.code === 'COMPOFF') {
                    setCompOffWorkedDate('');
                    setCompOffLeaveDate('');
                    setCompOffModalOpen(true);
                  }
                }}
                required
              >
                <option value="">Select leave type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {isCompOff ? (
                <button
                  type="button"
                  onClick={() => setCompOffModalOpen(true)}
                  className={`${inputClass} text-left`}
                  style={inputStyle}
                >
                  {form.fromDate ? (
                    <>
                      Worked <span style={{ color: '#16a34a', fontWeight: 600 }}>{compOffWorkedDate}</span>
                      {' → Off '}
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>{form.fromDate}</span>
                    </>
                  ) : (
                    'Choose comp-off dates…'
                  )}
                </button>
              ) : (
                <>
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
                </>
              )}
              {!isCompOff && (
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="checkbox"
                    checked={form.isHalfDay}
                    onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked, toDate: e.target.checked ? form.fromDate : form.toDate })}
                  />
                  Half day
                </label>
              )}
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Reason (optional)"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            {isCompOff && (
              <div className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Available Comp-Off balance: <strong>{compOffAvailable.toFixed(1)} day{compOffAvailable === 1 ? '' : 's'}</strong>
              </div>
            )}
            {!isCompOff && previewDays > 0 && (
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

      {compOffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setCompOffModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Compensatory Off</h2>
              <button onClick={() => setCompOffModalOpen(false)} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(59,130,246,0.06)' }}>
                Available Comp-Off balance: <strong>{compOffAvailable.toFixed(1)} day{compOffAvailable === 1 ? '' : 's'}</strong>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} />
                  Date You Worked
                </label>
                <input
                  type="date"
                  value={compOffWorkedDate}
                  onChange={(e) => setCompOffWorkedDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputClass}
                  style={{ ...inputStyle, borderColor: '#16a34a' }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>The weekly-off / holiday you came in and worked.</p>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#dc2626' }} />
                  Date You Want Off
                </label>
                <input
                  type="date"
                  value={compOffLeaveDate}
                  onChange={(e) => setCompOffLeaveDate(e.target.value)}
                  min={compOffWorkedDate || undefined}
                  className={inputClass}
                  style={{ ...inputStyle, borderColor: '#dc2626' }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>The day you will take off in lieu.</p>
              </div>

              {(compOffWorkedDate || compOffLeaveDate) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {compOffWorkedDate && (
                    <span className="rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                      Worked: {compOffWorkedDate}
                    </span>
                  )}
                  {compOffLeaveDate && (
                    <span className="rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                      Off: {compOffLeaveDate}
                    </span>
                  )}
                </div>
              )}

              {compOffAvailable <= 0 && (
                <p className="text-xs font-medium" style={{ color: '#dc2626' }}>
                  You have no Comp-Off balance available right now.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCompOffModalOpen(false);
                    if (!form.fromDate) setForm({ ...form, leaveMasterId: '' });
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!compOffWorkedDate || !compOffLeaveDate}
                  onClick={() => {
                    setForm({ ...form, fromDate: compOffLeaveDate, toDate: compOffLeaveDate, isHalfDay: false });
                    setCompOffModalOpen(false);
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary, #2563eb)' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
