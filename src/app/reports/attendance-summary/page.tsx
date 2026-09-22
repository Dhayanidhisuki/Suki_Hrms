/**
 * Attendance Summary Report — company-level attendance totals for a
 * selected period, with per-employee breakdown.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

interface ReportData {
  period: { year: number; month: number };
  headcount: number;
  totals: Record<string, number>;
  byDepartment: Array<{ department: string; count: number; lopDays: number; otMinutes: number; lateMinutes: number }>;
  employees: Array<{
    employeeCode: string; name: string; totalWorkingDays: number; payableDays: number;
    lopDays: number; otMinutes: number; lateMinutes: number; earlyOutMinutes: number; status: string;
  }>;
}

export default function AttendanceSummaryReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/attendance-summary?year=${year}&month=${month}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Failed'); }
      setData(await res.json());
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, [year, month, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const handleExport = () => { window.open(`/api/reports/attendance-summary?year=${year}&month=${month}&format=csv`, '_blank'); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Attendance Summary Report</h1>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
          <button onClick={handleExport} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Export CSV</button>
        </div>
      </div>
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : data ? (
        <div className="space-y-6">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Totals</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(data.totals).map(([key, val]) => (
                  <tr key={key} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 capitalize" style={{ color: 'var(--foreground-muted)' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                    <td className="py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{val.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>By Department</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Department</th><th className="py-2 text-right">Count</th><th className="py-2 text-right">LOP Days</th><th className="py-2 text-right">OT Min</th><th className="py-2 text-right">Late Min</th></tr></thead>
              <tbody>
                {data.byDepartment.map((d) => (
                  <tr key={d.department} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2">{d.department}</td><td className="py-2 text-right">{d.count}</td><td className="py-2 text-right">{d.lopDays}</td><td className="py-2 text-right">{d.otMinutes}</td><td className="py-2 text-right">{d.lateMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Per Employee</h2>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Code</th><th className="py-2 text-left">Name</th><th className="py-2 text-right">WD</th><th className="py-2 text-right">PD</th><th className="py-2 text-right">LOP</th><th className="py-2 text-right">OT</th><th className="py-2 text-right">Late</th><th className="py-2 text-left">Status</th></tr></thead>
                <tbody>
                  {data.employees.map((e, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{e.employeeCode}</td><td className="py-2">{e.name}</td><td className="py-2 text-right">{e.totalWorkingDays}</td><td className="py-2 text-right">{e.payableDays}</td><td className="py-2 text-right text-red-600">{e.lopDays}</td><td className="py-2 text-right">{e.otMinutes}</td><td className="py-2 text-right">{e.lateMinutes}</td><td className="py-2">{e.status}</td>
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
