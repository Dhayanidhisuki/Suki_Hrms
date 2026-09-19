/**
 * TDS Annual Summary — shows annual TDS calculation and month-by-month
 * projection for a selected employee.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

interface AnnualCalc {
  regime: string;
  grossYTD: number;
  otherIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  baseTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  annualTax: number;
  monthlyTDS: number;
  alreadyDeductedTDS: number;
  remainingMonths: number;
  remainingTDS: number;
  slabBreakdown: Array<{ code: string; minSalary: number; maxSalary: number | null; ratePercent: number; taxInSlab: number }>;
}

interface Projection {
  employeeId: number;
  financialYear: number;
  fyStartMonth: number;
  monthlyActuals: Array<{ month: string; year: number; gross: number; tds: number; status: string }>;
  annualCalc: AnnualCalc;
  projectedMonthlyTDS: number;
  summary: { grossYTD: number; tdsYTD: number; monthsProcessed: number; remainingMonths: number; annualTax: number; remainingTax: number };
}

export default function TdsAnnualSummaryPage() {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [financialYear, setFinancialYear] = useState(new Date().getUTCFullYear());
  const [projection, setProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProjection = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/tds/projection?employeeId=${employeeId}&financialYear=${financialYear}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setProjection(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, financialYear, toast]);

  useEffect(() => { if (employeeId) fetchProjection(); }, [fetchProjection]);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>TDS Annual Summary</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Annual TDS calculation and month-by-month projection.
        </p>
      </div>

      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee ID</label>
          <input
            type="number"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. 1"
            className="mt-1 w-32 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Financial Year</label>
          <input
            type="number"
            value={financialYear}
            onChange={(e) => setFinancialYear(parseInt(e.target.value))}
            className="mt-1 w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          onClick={fetchProjection}
          disabled={!employeeId || loading}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Calculate
        </button>
      </div>

      {loading && <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Calculating…</div>}

      {projection && !loading && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Regime</p>
              <p className="text-lg font-semibold mt-1">{projection.annualCalc.regime}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Taxable Income</p>
              <p className="text-lg font-semibold mt-1">{fmt(projection.annualCalc.taxableIncome)}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Annual Tax</p>
              <p className="text-lg font-semibold mt-1">{fmt(projection.annualCalc.annualTax)}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Remaining Tax</p>
              <p className="text-lg font-semibold mt-1" style={{ color: 'var(--warning)' }}>{fmt(projection.summary.remainingTax)}</p>
            </div>
          </div>

          {/* Tax breakdown */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Tax Breakdown</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-3">
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Gross YTD</span><span className="text-sm font-medium">{fmt(projection.annualCalc.grossYTD)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Other Income</span><span className="text-sm font-medium">{fmt(projection.annualCalc.otherIncome)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Deductions</span><span className="text-sm font-medium">{fmt(projection.annualCalc.totalDeductions)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Base Tax</span><span className="text-sm font-medium">{fmt(projection.annualCalc.baseTax)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>87A Rebate</span><span className="text-sm font-medium" style={{ color: 'var(--success)' }}>-{fmt(projection.annualCalc.rebate87A)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Surcharge</span><span className="text-sm font-medium">{fmt(projection.annualCalc.surcharge)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Cess</span><span className="text-sm font-medium">{fmt(projection.annualCalc.cess)}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>TDS Deducted YTD</span><span className="text-sm font-medium">{fmt(projection.annualCalc.alreadyDeductedTDS)}</span></div>
              <div className="flex justify-between border-t pt-2 mt-2"><span className="text-sm font-semibold">Annual Tax</span><span className="text-sm font-bold">{fmt(projection.annualCalc.annualTax)}</span></div>
            </div>
          </div>

          {/* Slab breakdown */}
          {projection.annualCalc.slabBreakdown.length > 0 && (
            <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Slab Breakdown</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <th className="text-left py-2">Slab</th>
                    <th className="text-right py-2">Min</th>
                    <th className="text-right py-2">Max</th>
                    <th className="text-right py-2">Rate</th>
                    <th className="text-right py-2">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.annualCalc.slabBreakdown.map((s, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{s.code}</td>
                      <td className="text-right py-2">{s.minSalary.toFixed(0)}</td>
                      <td className="text-right py-2">{s.maxSalary != null ? s.maxSalary.toFixed(0) : '—'}</td>
                      <td className="text-right py-2">{s.ratePercent}%</td>
                      <td className="text-right py-2">{s.taxInSlab.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Monthly projection */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Monthly Projection (FY {projection.financialYear}-{projection.financialYear + 1})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Gross</th>
                  <th className="text-right py-2">TDS</th>
                  <th className="text-right py-2">Projected TDS</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {projection.monthlyActuals.map((m, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2">{m.month} {m.year}</td>
                    <td className="text-right py-2">{m.gross > 0 ? fmt(m.gross) : '—'}</td>
                    <td className="text-right py-2">{m.tds > 0 ? fmt(m.tds) : '—'}</td>
                    <td className="text-right py-2" style={{ color: 'var(--warning)' }}>
                      {m.status === 'NOT_RUN' && projection.projectedMonthlyTDS > 0 ? fmt(projection.projectedMonthlyTDS) : '—'}
                    </td>
                    <td className="py-2">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
