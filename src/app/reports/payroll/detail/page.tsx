/**
 * Complete Payroll Report — source + computed data side-by-side.
 *
 * Summary view: one row per employee with gross, OT, other earnings,
 * PF, ESI, PT, TDS, other deductions, net.
 * Toggle to full detail: all PayrollLineComponent rows (earning +
 * deduction) with source salary components and attendance data.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

interface SourceSalaryComponent {
  code: string;
  name: string;
  type: string;
  amount: number;
  includeInPf: boolean;
  includeInEsi: boolean;
  includeInGross: boolean;
  grossTier: string;
}

interface ComputedComponent {
  id: number;
  code: string;
  name: string;
  type: string;
  amount: number;
  isAdhoc: boolean;
}

interface PayrollRow {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  wageType: string;
  lineStatus: string;
  holdReason: string | null;
  attendanceStatus: string;
  totalWorkingDays: number;
  payableDays: number;
  lopDays: number;
  presentDays: number;
  otMinutesSource: number;
  lateMinutesSource: number;
  earlyOutMinutesSource: number;
  sourceGrossSalary: number;
  sourceSalaryComponents: SourceSalaryComponent[];
  totalWorkingDaysComputed: number;
  payableDaysComputed: number;
  lopDaysComputed: number;
  grossEarnings: number;
  fixedGross: number;
  additionalGross: number;
  performanceIncentive: number;
  otAmount: number;
  otIncentiveAmount: number;
  otherEarningsTotal: number;
  pfEmployee: number;
  pfEmployer: number;
  epsEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  otherDeductionsTotal: number;
  lomAmount: number;
  lwfAmount: number;
  healthInsurance: number;
  licAmount: number;
  netSalary: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  computedComponents: ComputedComponent[];
  earningsComponents: ComputedComponent[];
  deductionComponents: ComputedComponent[];
  sourceEarningsTotal: number;
  computedGrossEarnings: number;
  grossMatch: boolean;
}

interface ReportData {
  run: { id: number; year: number; month: number; status: string };
  headcount: { total: number; ok: number; hold: number };
  rows: PayrollRow[];
  totals: Record<string, number>;
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollDetailReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/payroll/detail?year=${year}&month=${month}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load report');
      }
      setData(await res.json());
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    setExpandedRows(new Set(data.rows.map((r) => r.id)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const handleExport = (full: boolean) => {
    const params = new URLSearchParams({ year: String(year), month: String(month), format: 'csv' });
    if (full) params.set('view', 'full');
    window.open(`/api/reports/payroll/detail?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Complete Payroll Report</h1>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <button onClick={() => handleExport(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>
            Export Summary CSV
          </button>
          <button onClick={() => handleExport(true)} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            Export Full CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Headcount + Totals Cards */}
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

          {/* Totals Summary */}
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Company Totals (OK lines only)</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Gross Earnings</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.grossEarnings ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Amount</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otAmount ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Other Earnings</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otherEarningsTotal ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>PF Employee</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.pfEmployee ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>ESI Employee</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.esiEmployee ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Professional Tax</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.professionalTax ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>TDS</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.tds ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>LOM Amount</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.lomAmount ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>LWF Amount</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.lwfAmount ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Health Insurance</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.healthInsurance ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Other Deductions</div>
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otherDeductionsTotal ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Net Salary</div>
                <div className="text-sm font-bold text-green-600">{money(data.totals.netSalary ?? 0)}</div>
              </div>
            </div>
          </div>

          {/* Expand/Collapse controls */}
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Expand All
            </button>
            <button onClick={collapseAll} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Collapse All
            </button>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}></th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Payable</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>LOP</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Source Gross</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Computed Gross</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Other Earn</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>PF</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>ESI</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>PT</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>TDS</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Other Ded</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Net Salary</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                      No payroll lines for this period.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <>
                      <tr
                        key={r.id}
                        className="transition-colors cursor-pointer"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => toggleRow(r.id)}
                      >
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs" style={{ color: 'var(--accent)' }}>
                            {expandedRows.has(r.id) ? '▼' : '▶'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{r.employeeCode}</td>
                        <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.employeeName}</td>
                        <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.department}</td>
                        <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.payableDays}</td>
                        <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.lopDays}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground-muted)' }}>{money(r.sourceGrossSalary)}</td>
                        <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>
                          {money(r.grossEarnings)}
                          {!r.grossMatch && (
                            <span className="ml-1 text-xs text-amber-600" title={`Source: ${r.sourceEarningsTotal.toFixed(2)}, Computed: ${r.computedGrossEarnings.toFixed(2)}`}>⚠</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.otAmount)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.otherEarningsTotal)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.pfEmployee)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.esiEmployee)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.professionalTax)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.tds)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.otherDeductionsTotal)}</td>
                        <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(r.netSalary)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium ${r.lineStatus === 'OK' ? 'text-green-600' : 'text-red-500'}`}>
                            {r.lineStatus}
                          </span>
                        </td>
                      </tr>
                      {expandedRows.has(r.id) && (
                        <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                          <td colSpan={17} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                              {/* Source: Salary Components */}
                              <div>
                                <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>
                                  Source: Salary Components (Revision)
                                </h3>
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Type</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Amount</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>PF</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>ESI</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>Gross</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.sourceSalaryComponents.map((c, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{c.code}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                                        <td className="px-2 py-1" style={{ color: c.type === 'earning' ? 'text-green-600' : 'text-red-500' }}>{c.type}</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(c.amount)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: c.includeInPf ? 'text-green-600' : 'var(--foreground-muted)' }}>{c.includeInPf ? '✓' : '—'}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: c.includeInEsi ? 'text-green-600' : 'var(--foreground-muted)' }}>{c.includeInEsi ? '✓' : '—'}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: c.includeInGross ? 'text-green-600' : 'var(--foreground-muted)' }}>{c.includeInGross ? '✓' : '—'}</td>
                                      </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                                      <td colSpan={3} className="px-2 py-1 text-right font-bold" style={{ color: 'var(--foreground)' }}>Source Gross Total:</td>
                                      <td className="px-2 py-1 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(r.sourceEarningsTotal)}</td>
                                      <td colSpan={3}></td>
                                    </tr>
                                  </tbody>
                                </table>
                                {/* Attendance source */}
                                <div className="mt-3 space-y-1 text-xs">
                                  <div style={{ color: 'var(--foreground-muted)' }}>
                                    Attendance: <span style={{ color: 'var(--foreground)' }}>{r.attendanceStatus}</span>
                                    {' · '}Payable: <span style={{ color: 'var(--foreground)' }}>{r.payableDays}</span>
                                    {' · '}LOP: <span style={{ color: 'var(--foreground)' }}>{r.lopDays}</span>
                                    {' · '}Wage Type: <span style={{ color: 'var(--foreground)' }}>{r.wageType}</span>
                                  </div>
                                  {r.holdReason && (
                                    <div className="text-red-500">Hold: {r.holdReason}</div>
                                  )}
                                </div>
                              </div>

                              {/* Computed: Earnings Components */}
                              <div>
                                <h3 className="mb-2 text-xs font-semibold uppercase text-green-600">
                                  Computed: Earnings (PayrollLineComponent)
                                </h3>
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Amount</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>Adhoc</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.earningsComponents.map((c, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{c.code}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(c.amount)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: c.isAdhoc ? 'text-amber-600' : 'var(--foreground-muted)' }}>{c.isAdhoc ? '✓' : '—'}</td>
                                      </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                                      <td colSpan={2} className="px-2 py-1 text-right font-bold" style={{ color: 'var(--foreground)' }}>Total Earnings:</td>
                                      <td className="px-2 py-1 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(r.earningsComponents.reduce((s, c) => s + c.amount, 0))}</td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Computed: Deductions Components */}
                              <div>
                                <h3 className="mb-2 text-xs font-semibold uppercase text-red-500">
                                  Computed: Deductions (PayrollLineComponent)
                                </h3>
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                                      <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                                      <th className="px-2 py-1 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Amount</th>
                                      <th className="px-2 py-1 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>Adhoc</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.deductionComponents.map((c, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{c.code}</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(c.amount)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: c.isAdhoc ? 'text-amber-600' : 'var(--foreground-muted)' }}>{c.isAdhoc ? '✓' : '—'}</td>
                                      </tr>
                                    ))}
                                    {/* Statutory deductions not in PayrollLineComponent */}
                                    {r.pfEmployee > 0 && (
                                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>PF</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>Provident Fund (Employee)</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(r.pfEmployee)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: 'var(--foreground-muted)' }}>—</td>
                                      </tr>
                                    )}
                                    {r.esiEmployee > 0 && (
                                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>ESI</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>ESI (Employee)</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(r.esiEmployee)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: 'var(--foreground-muted)' }}>—</td>
                                      </tr>
                                    )}
                                    {r.professionalTax > 0 && (
                                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>PT</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>Professional Tax</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(r.professionalTax)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: 'var(--foreground-muted)' }}>—</td>
                                      </tr>
                                    )}
                                    {r.tds > 0 && (
                                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>TDS</td>
                                        <td className="px-2 py-1" style={{ color: 'var(--foreground)' }}>Tax Deducted at Source</td>
                                        <td className="px-2 py-1 text-right" style={{ color: 'var(--foreground)' }}>{money(r.tds)}</td>
                                        <td className="px-2 py-1 text-center" style={{ color: 'var(--foreground-muted)' }}>—</td>
                                      </tr>
                                    )}
                                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                                      <td colSpan={2} className="px-2 py-1 text-right font-bold" style={{ color: 'var(--foreground)' }}>Total Deductions:</td>
                                      <td className="px-2 py-1 text-right font-bold text-red-500">
                                        {money(r.pfEmployee + r.esiEmployee + r.professionalTax + r.tds + r.otherDeductionsTotal)}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'var(--surface-hover)' }}>
                    <td colSpan={4}></td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.grossEarnings ? '' : ''}</td>
                    <td colSpan={2}></td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.grossEarnings ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otAmount ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otherEarningsTotal ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.pfEmployee ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.esiEmployee ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.professionalTax ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.tds ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otherDeductionsTotal ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-bold text-green-600" style={{ color: 'var(--foreground)' }}>{money(data.totals.netSalary ?? 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
