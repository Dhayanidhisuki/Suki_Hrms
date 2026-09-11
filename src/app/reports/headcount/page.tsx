/**
 * Headcount Report — employee count by department, employee type,
 * designation, and gender.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReportData {
  asOfDate: string;
  totalHeadcount: number;
  byDepartment: Array<{ department: string; count: number }>;
  byEmployeeType: Array<{ employeeType: string; count: number }>;
  byDesignation: Array<{ designation: string; count: number }>;
  byGender: Array<{ gender: string; count: number }>;
}

export default function HeadcountReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/reports/headcount');
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const handleExport = () => { window.open('/api/reports/headcount?format=csv', '_blank'); };

  const renderBreakdown = (title: string, data: Array<{ [key: string]: string | number }>, labelKey: string) => (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
      <table className="w-full text-sm">
        <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}><th className="py-2 text-left">{labelKey}</th><th className="py-2 text-right">Count</th></tr></thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
              <td className="py-2 capitalize">{String(item[labelKey.toLowerCase()] ?? item[Object.keys(item)[0]])}</td>
              <td className="py-2 text-right font-medium">{Number(item.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Headcount Report</h1>
        <button onClick={handleExport} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Export CSV</button>
      </div>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : data ? (
        <div className="space-y-6">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Headcount (as of {data.asOfDate})</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{data.totalHeadcount}</div>
          </div>
          {renderBreakdown('By Department', data.byDepartment as Array<{ [key: string]: string | number }>, 'Department')}
          {renderBreakdown('By Employee Type', data.byEmployeeType as Array<{ [key: string]: string | number }>, 'EmployeeType')}
          {renderBreakdown('By Designation', data.byDesignation as Array<{ [key: string]: string | number }>, 'Designation')}
          {renderBreakdown('By Gender', data.byGender as Array<{ [key: string]: string | number }>, 'Gender')}
        </div>
      ) : null}
    </div>
  );
}
