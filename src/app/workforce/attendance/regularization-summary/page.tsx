/**
 * Attendance Regularization Summary — shows counts of all pending and
 * resolved regularization requests (mispunch, permission, OT) for a month.
 * HR uses this to track what needs action before payroll.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui';

interface SummaryData {
  period: { year: number; month: number };
  counts: {
    mispunch: Record<string, number>;
    permission: Record<string, number>;
    ot: Record<string, number>;
  };
  employees: Array<{
    employeeId: number;
    employeeCode: string;
    name: string;
    mispunch: { pending: number; approved: number; rejected: number };
    permission: { pending: number; approved: number; rejected: number; excessHours: number };
    ot: { pending: number; approved: number; rejected: number; otMinutes: number };
  }>;
}

export default function RegularizationSummaryPage() {
  const toast = useToast();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/attendance/regularization-summary?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPending = data
    ? data.counts.mispunch.pending_manager + data.counts.mispunch.pending_hr +
      data.counts.permission.pending_manager + data.counts.permission.pending_hr +
      data.counts.ot.pending_manager + data.counts.ot.pending_hr
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Regularization Summary</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          All attendance regularization requests for the month — track what needs action before payroll.
        </p>
      </div>

      {/* Period selector */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="mt-1 w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          >
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}

      {data && !loading && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Pending</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: totalPending > 0 ? 'var(--warning)' : 'var(--success)' }}>{totalPending}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Mispunch</p>
              <p className="text-2xl font-semibold mt-1">{data.counts.mispunch.pending_manager + data.counts.mispunch.pending_hr} pending</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Permission</p>
              <p className="text-2xl font-semibold mt-1">{data.counts.permission.pending_manager + data.counts.permission.pending_hr} pending</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Approvals</p>
              <p className="text-2xl font-semibold mt-1">{data.counts.ot.pending_manager + data.counts.ot.pending_hr} pending</p>
            </div>
          </div>

          {/* Counts by type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Mispunch */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h3 className="text-sm font-semibold mb-3">Mispunch</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Pending (Manager)</span><span>{data.counts.mispunch.pending_manager}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Pending (HR)</span><span>{data.counts.mispunch.pending_hr}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Approved</span><span style={{ color: 'var(--success)' }}>{data.counts.mispunch.approved}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Rejected</span><span style={{ color: 'var(--danger)' }}>{data.counts.mispunch.rejected}</span></div>
              </div>
              <Link href="/workforce/mispunch" className="mt-3 inline-block text-xs underline" style={{ color: 'var(--primary)' }}>Go to Mispunch →</Link>
            </div>

            {/* Permission */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h3 className="text-sm font-semibold mb-3">Permission</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Pending (Manager)</span><span>{data.counts.permission.pending_manager}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Pending (HR)</span><span>{data.counts.permission.pending_hr}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Approved</span><span style={{ color: 'var(--success)' }}>{data.counts.permission.approved}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Rejected</span><span style={{ color: 'var(--danger)' }}>{data.counts.permission.rejected}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Excess → LOP</span><span style={{ color: 'var(--warning)' }}>{data.counts.permission.excess}</span></div>
              </div>
              <Link href="/workforce/permission" className="mt-3 inline-block text-xs underline" style={{ color: 'var(--primary)' }}>Go to Permission →</Link>
            </div>

            {/* OT */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h3 className="text-sm font-semibold mb-3">Overtime</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Pending (Manager)</span><span>{data.counts.ot.pending_manager}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Pending (HR)</span><span>{data.counts.ot.pending_hr}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Approved (OT)</span><span style={{ color: 'var(--success)' }}>{data.counts.ot.approved - data.counts.ot.comp_off}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Approved (Comp-Off)</span><span style={{ color: 'var(--success)' }}>{data.counts.ot.comp_off}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Rejected</span><span style={{ color: 'var(--danger)' }}>{data.counts.ot.rejected}</span></div>
              </div>
            </div>
          </div>

          {/* Per-employee breakdown */}
          {data.employees.length > 0 && (
            <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Per-Employee Breakdown</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-2">Code</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-center py-2">Mispunch (P/A/R)</th>
                    <th className="text-center py-2">Permission (P/A/R)</th>
                    <th className="text-center py-2">Perm Excess (hrs)</th>
                    <th className="text-center py-2">OT (P/A/R)</th>
                    <th className="text-center py-2">OT Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((e) => (
                    <tr key={e.employeeId} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{e.employeeCode}</td>
                      <td className="py-2">{e.name}</td>
                      <td className="text-center py-2">{e.mispunch.pending}/{e.mispunch.approved}/{e.mispunch.rejected}</td>
                      <td className="text-center py-2">{e.permission.pending}/{e.permission.approved}/{e.permission.rejected}</td>
                      <td className="text-center py-2" style={{ color: e.permission.excessHours > 0 ? 'var(--warning)' : 'inherit' }}>{e.permission.excessHours}</td>
                      <td className="text-center py-2">{e.ot.pending}/{e.ot.approved}/{e.ot.rejected}</td>
                      <td className="text-center py-2">{e.ot.otMinutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
