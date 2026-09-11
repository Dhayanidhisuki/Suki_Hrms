/**
 * Payroll Reconciliation — shows discrepancies between PayrollLine totals
 * and component sums, missing bank details, negative net salary, etc.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface ReconData {
  run: { id: number; year: number; month: number; status: string };
  summary: {
    headcount: number;
    okCount: number;
    holdCount: number;
    totalGross: string;
    totalNet: string;
    totalDeductions: string;
    componentEarningsSum: string;
    componentDeductionsSum: string;
    grossReconciled: boolean;
  };
  discrepancies: Array<{ employeeCode: string; name: string; type: string; detail: string }>;
  discrepancyCount: number;
}

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: string;
}

const TYPE_COLORS: Record<string, string> = {
  MISSING_BANK: 'var(--warning)',
  MISSING_SALARY: 'var(--danger)',
  NEGATIVE_NET: 'var(--danger)',
  GROSS_MISMATCH: 'var(--warning)',
};

export default function ReconciliationPage() {
  const searchParams = useSearchParams();
  const initialRunId = searchParams.get('runId');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState(initialRunId ?? '');
  const [recon, setRecon] = useState<ReconData | null>(null);
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

  const fetchRecon = useCallback(async () => {
    if (!selectedRun) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun}/reconciliation`);
      if (!res.ok) throw new Error('Failed to fetch reconciliation');
      const json = await res.json();
      setRecon(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  useEffect(() => { fetchRecon(); }, [fetchRecon]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Payroll Reconciliation</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Verify payroll totals and identify discrepancies.
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

      {recon && !loading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Headcount</p>
              <p className="text-2xl font-semibold mt-1">{recon.summary.headcount}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Gross</p>
              <p className="text-lg font-semibold mt-1">{recon.summary.totalGross}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Total Net</p>
              <p className="text-lg font-semibold mt-1">{recon.summary.totalNet}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Discrepancies</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: recon.discrepancyCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {recon.discrepancyCount}
              </p>
            </div>
          </div>

          {/* Reconciliation status */}
          <div className={`rounded-xl border p-4 ${recon.summary.grossReconciled ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <p className="text-sm font-medium">
              {recon.summary.grossReconciled
                ? '✓ Gross earnings reconciled — PayrollLine totals match component sums'
                : '✗ Gross mismatch — PayrollLine totals do not match component sums'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
              Line gross: {recon.summary.totalGross} | Component sum: {recon.summary.componentEarningsSum}
            </p>
          </div>

          {/* Discrepancies */}
          {recon.discrepancies.length > 0 && (
            <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Discrepancies ({recon.discrepancies.length})
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-2">Code</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.discrepancies.map((d, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{d.employeeCode}</td>
                      <td className="py-2">{d.name}</td>
                      <td className="py-2" style={{ color: TYPE_COLORS[d.type] ?? 'var(--foreground)' }}>{d.type}</td>
                      <td className="py-2">{d.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recon.discrepancies.length === 0 && recon.summary.grossReconciled && (
            <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center">
              <p className="text-sm font-medium text-green-700">✓ All checks passed — no discrepancies found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
