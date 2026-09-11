/**
 * Payroll Summary — shows totals by component type, headcount, and
 * per-employee-type breakdown for a selected payroll run.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface SummaryData {
  run: { id: number; year: number; month: number; status: string };
  headcount: { total: number; ok: number; hold: number };
  totals: Record<string, number>;
  byEmployeeType: Array<{ employeeTypeId: number; employeeTypeName: string; count: number; gross: number; net: number }>;
  holdReasons: Array<{ employeeCode: string; name: string; holdReason: string | null }>;
}

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: string;
}

export default function PayrollSummaryPage() {
  const searchParams = useSearchParams();
  const initialRunId = searchParams.get('runId');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState(initialRunId ?? '');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/payroll/runs')
      .then((r) => r.json())
      .then((json) => {
        setRuns(json.data ?? []);
        if (json.data?.length > 0 && !initialRunId) {
          setSelectedRun(String(json.data[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialRunId]);

  const fetchSummary = useCallback(async () => {
    if (!selectedRun) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun}/summary`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const json = await res.json();
      setSummary(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payroll Summary</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Totals and breakdown for a payroll run.
        </p>
      </div>

      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Payroll Run</label>
          <select
            value={selectedRun}
            onChange={(e) => setSelectedRun(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          >
            <option value="">Select…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>{r.year}-{String(r.month).padStart(2, '0')} ({r.status})</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}

      {summary && !loading && (
        <div className="space-y-6">
          {/* Headcount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Employees</p>
              <p className="text-2xl font-semibold mt-1">{summary.headcount.total}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Processed (OK)</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--success)' }}>{summary.headcount.ok}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>On Hold</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--warning)' }}>{summary.headcount.hold}</p>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Totals</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-3">
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Gross Earnings</span><span className="text-sm font-medium">{fmt(summary.totals.grossEarnings)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>OT Amount</span><span className="text-sm font-medium">{fmt(summary.totals.otAmount)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Other Earnings</span><span className="text-sm font-medium">{fmt(summary.totals.otherEarnings)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>PF Employee</span><span className="text-sm font-medium">{fmt(summary.totals.pfEmployee)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>PF Employer</span><span className="text-sm font-medium">{fmt(summary.totals.pfEmployer)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>ESI Employee</span><span className="text-sm font-medium">{fmt(summary.totals.esiEmployee)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Professional Tax</span><span className="text-sm font-medium">{fmt(summary.totals.professionalTax)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>TDS</span><span className="text-sm font-medium">{fmt(summary.totals.tds)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>LOM</span><span className="text-sm font-medium">{fmt(summary.totals.lomAmount)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>LWF</span><span className="text-sm font-medium">{fmt(summary.totals.lwfAmount)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Health Insurance</span><span className="text-sm font-medium">{fmt(summary.totals.healthInsurance)}</span></div>
              <div className="flex justify-between border-t pt-2 mt-2"><span className="text-sm font-semibold">Net Salary</span><span className="text-sm font-bold">{fmt(summary.totals.netSalary)}</span></div>
            </div>
          </div>

          {/* By Employee Type */}
          {summary.byEmployeeType.length > 0 && (
            <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>By Employee Type</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Count</th>
                    <th className="text-right py-2">Gross</th>
                    <th className="text-right py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byEmployeeType.map((t) => (
                    <tr key={t.employeeTypeId} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{t.employeeTypeName}</td>
                      <td className="text-right py-2">{t.count}</td>
                      <td className="text-right py-2">{fmt(t.gross)}</td>
                      <td className="text-right py-2">{fmt(t.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hold Reasons */}
          {summary.holdReasons.length > 0 && (
            <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>On Hold ({summary.holdReasons.length})</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-2">Code</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.holdReasons.map((h, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{h.employeeCode}</td>
                      <td className="py-2">{h.name}</td>
                      <td className="py-2" style={{ color: 'var(--warning)' }}>{h.holdReason}</td>
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
