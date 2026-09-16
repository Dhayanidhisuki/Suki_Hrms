/**
 * Leave Report — leave applications per employee for a selected period
 * with leave type, dates, days, status, and current leave balances.
 * Includes by-leave-type summary and status breakdown.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface AppRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  isPaid: boolean;
  fromDate: string;
  toDate: string;
  numberOfDays: number;
  isHalfDay: boolean;
  calendarDays: number | null;
  status: string;
  reason: string | null;
  appliedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
}

interface BalanceRow {
  employeeCode: string;
  employeeName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  openingBalance: number;
  accrued: number;
  availed: number;
  adjusted: number;
  closingBalance: number;
  encashed: number;
  lapsed: number;
  expired: number;
  pendingApproval: number;
}

interface ReportData {
  period: { year: number; month: number };
  statusSummary: {
    total: number;
    approved: number;
    pendingManager: number;
    pendingHr: number;
    rejected: number;
    cancelled: number;
  };
  byLeaveType: Array<{ leaveType: string; count: number; days: number; approved: number; pending: number; rejected: number }>;
  applications: AppRow[];
  balances: BalanceRow[];
}

const statusColor: Record<string, string> = {
  approved: '#166534',
  pending_manager: '#b45309',
  pending_hr: '#b45309',
  rejected: '#dc2626',
  cancelled: '#6b7280',
};

const statusLabel: Record<string, string> = {
  approved: 'Approved',
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function LeaveReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'applications' | 'balances'>('applications');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/attendance/leave-summary?year=${year}&month=${month}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load report');
      }
      setData(await res.json());
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleExport = () => {
    window.open(`/api/reports/attendance/leave-summary?year=${year}&month=${month}&format=csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Leave Report</h1>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
          <button onClick={handleExport} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Export CSV</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : data ? (
        <div className="space-y-6">
          {/* Status Summary Cards */}
          <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.statusSummary.total}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm text-green-600">Approved</div>
              <div className="text-2xl font-bold text-green-600">{data.statusSummary.approved}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm text-amber-600">Pending Mgr</div>
              <div className="text-2xl font-bold text-amber-600">{data.statusSummary.pendingManager}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm text-amber-600">Pending HR</div>
              <div className="text-2xl font-bold text-amber-600">{data.statusSummary.pendingHr}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm text-red-600">Rejected</div>
              <div className="text-2xl font-bold text-red-600">{data.statusSummary.rejected}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Cancelled</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground-muted)' }}>{data.statusSummary.cancelled}</div>
            </div>
          </div>

          {/* By Leave Type */}
          {data.byLeaveType.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>By Leave Type</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="py-2 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave Type</th>
                      <th className="py-2 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Count</th>
                      <th className="py-2 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Days</th>
                      <th className="py-2 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Approved</th>
                      <th className="py-2 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Pending</th>
                      <th className="py-2 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byLeaveType.map((t, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-2" style={{ color: 'var(--foreground)' }}>{t.leaveType}</td>
                        <td className="py-2 text-right" style={{ color: 'var(--foreground)' }}>{t.count}</td>
                        <td className="py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{t.days.toFixed(2)}</td>
                        <td className="py-2 text-right text-green-600">{t.approved}</td>
                        <td className="py-2 text-right text-amber-600">{t.pending}</td>
                        <td className="py-2 text-right text-red-500">{t.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('applications')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'applications' ? 'text-white' : ''}`}
              style={view === 'applications' ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Applications
            </button>
            <button
              onClick={() => setView('balances')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'balances' ? 'text-white' : ''}`}
              style={view === 'balances' ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Balances
            </button>
          </div>

          {/* Applications Table */}
          {view === 'applications' && (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave Type</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>From</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>To</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Days</th>
                    <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Half</th>
                    <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Paid</th>
                    <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.applications.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>No leave applications for this period.</td></tr>
                  ) : data.applications.map((a) => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{a.employeeCode}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{a.employeeName}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{a.department}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{a.leaveTypeName}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{a.fromDate}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{a.toDate}</td>
                      <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>{a.numberOfDays.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center" style={{ color: a.isHalfDay ? '#b45309' : 'var(--foreground-muted)' }}>{a.isHalfDay ? '✓' : '—'}</td>
                      <td className="px-3 py-3 text-center" style={{ color: a.isPaid ? '#166534' : 'var(--foreground-muted)' }}>{a.isPaid ? '✓' : '—'}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium" style={{ color: statusColor[a.status] ?? 'var(--foreground)' }}>
                          {statusLabel[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{a.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Balances Table */}
          {view === 'balances' && (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                    <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave Type</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Opening</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Accrued</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Availed</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Encashed</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Lapsed</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Expired</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Pending</th>
                    <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.balances.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>No leave balances for this year.</td></tr>
                  ) : data.balances.map((b, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{b.employeeCode}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{b.employeeName}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{b.leaveTypeName}</td>
                      <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground-muted)' }}>{b.openingBalance.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-green-600">{b.accrued.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-red-500">{b.availed.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{b.encashed.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{b.lapsed.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{b.expired.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-amber-600">{b.pendingApproval.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{b.closingBalance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
