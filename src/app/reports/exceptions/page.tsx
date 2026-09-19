/**
 * Exception Report — employees on HOLD, with negative net, zero gross,
 * or other payroll validation issues.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

interface ReportData {
  period: { year: number; month: number };
  runStatus: string;
  totalLines: number;
  totalExceptions: number;
  errorCount: number;
  warningCount: number;
  exceptions: Array<{
    employeeCode: string; name: string; exceptionType: string; details: string; severity: string;
  }>;
}

export default function ExceptionReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/exceptions?year=${year}&month=${month}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Failed'); }
      setData(await res.json());
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, [year, month, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const handleExport = () => { window.open(`/api/reports/exceptions?year=${year}&month=${month}&format=csv`, '_blank'); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Exception Report</h1>
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
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Lines</div><div className="text-2xl font-bold">{data.totalLines}</div></div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Exceptions</div><div className="text-2xl font-bold">{data.totalExceptions}</div></div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm text-red-600">Errors</div><div className="text-2xl font-bold text-red-600">{data.errorCount}</div></div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><div className="text-sm text-yellow-600">Warnings</div><div className="text-2xl font-bold text-yellow-600">{data.warningCount}</div></div>
          </div>
          {data.exceptions.length > 0 ? (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Exceptions</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">Code</th><th className="py-2 text-left">Name</th><th className="py-2 text-left">Type</th><th className="py-2 text-left">Details</th><th className="py-2 text-left">Severity</th></tr></thead>
                <tbody>
                  {data.exceptions.map((e, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{e.employeeCode}</td><td className="py-2">{e.name}</td><td className="py-2 font-medium">{e.exceptionType}</td><td className="py-2">{e.details}</td>
                      <td className="py-2"><span className={e.severity === 'ERROR' ? 'text-red-600' : 'text-yellow-600'}>{e.severity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="rounded-lg border p-4 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>No exceptions found.</div>}
        </div>
      ) : null}
    </div>
  );
}
