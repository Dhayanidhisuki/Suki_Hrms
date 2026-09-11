/**
 * Payroll Summary Report — company-level totals by component type,
 * headcount, gross/net, statutory breakdown for a selected period.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReportData {
  run: { id: number; year: number; month: number; status: string };
  headcount: { total: number; ok: number; hold: number };
  totals: Record<string, number>;
  byDepartment: Array<{ department: string; count: number; gross: number; net: number }>;
  holdReasons: Array<{ employeeCode: string; name: string; holdReason: string | null }>;
}

export default function PayrollSummaryReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/payroll-summary?year=${year}&month=${month}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Failed'); }
      setData(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => { window.open(`/api/reports/payroll-summary?year=${year}&month=${month}&format=csv`, '_blank'); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payroll Summary Report</h1>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Employees</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.headcount.total}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>OK</div>
              <div className="text-2xl font-bold text-green-600">{data.headcount.ok}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>HOLD</div>
              <div className="text-2xl font-bold text-red-600">{data.headcount.hold}</div>
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Totals</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(data.totals).map(([key, val]) => (
                  <tr key={key} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 capitalize" style={{ color: 'var(--foreground-muted)' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                    <td className="py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{val.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>By Department</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Department</th><th className="py-2 text-right">Count</th><th className="py-2 text-right">Gross</th><th className="py-2 text-right">Net</th></tr></thead>
              <tbody>
                {data.byDepartment.map((d) => (
                  <tr key={d.department} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2">{d.department}</td><td className="py-2 text-right">{d.count}</td><td className="py-2 text-right">{d.gross.toFixed(2)}</td><td className="py-2 text-right">{d.net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.holdReasons.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold text-red-600">Hold Reasons</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Code</th><th className="py-2 text-left">Name</th><th className="py-2 text-left">Reason</th></tr></thead>
                <tbody>
                  {data.holdReasons.map((h, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{h.employeeCode}</td><td className="py-2">{h.name}</td><td className="py-2 text-red-600">{h.holdReason ?? 'N/A'}</td>
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
