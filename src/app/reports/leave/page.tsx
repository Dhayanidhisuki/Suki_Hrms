/**
 * Leave Report — leave applications, balances, and utilization by
 * leave type for a selected period.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReportData {
  period: { year: number; month: number };
  totalApplications: number;
  approved: number;
  pending: number;
  rejected: number;
  byLeaveType: Array<{ leaveType: string; count: number; days: number }>;
  balances: Array<{
    employeeCode: string; name: string; leaveType: string;
    opening: number; accrued: number; availed: number; closing: number;
  }>;
}

export default function LeaveReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/reports/leave?year=${year}&month=${month}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Failed'); }
      setData(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const handleExport = () => { window.open(`/api/reports/leave?year=${year}&month=${month}&format=csv`, '_blank'); };

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
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total</div><div className="text-2xl font-bold">{data.totalApplications}</div></div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm text-green-600">Approved</div><div className="text-2xl font-bold text-green-600">{data.approved}</div></div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm text-yellow-600">Pending</div><div className="text-2xl font-bold text-yellow-600">{data.pending}</div></div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm text-red-600">Rejected</div><div className="text-2xl font-bold text-red-600">{data.rejected}</div></div>
          </div>
          {data.byLeaveType.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>By Leave Type</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Leave Type</th><th className="py-2 text-right">Count</th><th className="py-2 text-right">Days</th></tr></thead>
                <tbody>
                  {data.byLeaveType.map((t, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}><td className="py-2">{t.leaveType}</td><td className="py-2 text-right">{t.count}</td><td className="py-2 text-right">{t.days}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Leave Balances</h2>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Code</th><th className="py-2 text-left">Name</th><th className="py-2 text-left">Leave Type</th><th className="py-2 text-right">Opening</th><th className="py-2 text-right">Accrued</th><th className="py-2 text-right">Availed</th><th className="py-2 text-right">Closing</th></tr></thead>
                <tbody>
                  {data.balances.map((b, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{b.employeeCode}</td><td className="py-2">{b.name}</td><td className="py-2">{b.leaveType}</td><td className="py-2 text-right">{b.opening}</td><td className="py-2 text-right">{b.accrued}</td><td className="py-2 text-right">{b.availed}</td><td className="py-2 text-right font-medium">{b.closing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
