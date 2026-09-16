/**
 * Complete OT Report — source + computed data side-by-side.
 *
 * Monthly summary per employee with expandable per-day OT detail.
 * Shows source (DailyAttendance OT minutes, MonthlyAttendanceSummary)
 * vs computed (PayrollLine OT amount, OT incentive) with OT plan config.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface DailyOtRow {
  date: string;
  shiftCode: string;
  shiftName: string;
  status: string;
  otMinutesCalculated: number;
  otMinutesApproved: number | null;
  otApprovalStatus: string;
  otSettlementType: string;
  dayType: string;
  factorApplied: number;
  payableOtMinutes: number;
  payableOtHours: number;
}

interface OtRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  overtimeAllowed: boolean;
  otMinutesTotalSource: number;
  otHoursSource: number;
  otMinutesFromDaysSource: number;
  otHoursFromDaysSource: number;
  attendanceStatus: string;
  payableDays: number;
  lopDays: number;
  otAmountComputed: number;
  otIncentiveAmountComputed: number;
  lineStatus: string;
  otPlanCode: string;
  otPlanName: string;
  otBasis: string;
  otRateMultiplier: number;
  applicableAfterMinutes: number;
  maxOtHoursPerDay: number | null;
  maxOtHoursPerWeek: number | null;
  maxOtHoursPerMonth: number | null;
  matchedSlabCode: string | null;
  matchedSlabName: string | null;
  matchedSlabType: string | null;
  matchedSlabFlatBonus: number | null;
  matchedSlabMultiplier: number | null;
  dailyBreakdown: DailyOtRow[];
  dailyOtDays: number;
}

interface OtPlanInfo {
  code: string;
  name: string;
  otBasis: string;
  rateMultiplier: number;
  applicableAfterMinutes: number;
  maxOtHoursPerDay: number | null;
  maxOtHoursPerWeek: number | null;
  maxOtHoursPerMonth: number | null;
}

interface ReportData {
  run: { id: number; year: number; month: number; status: string } | null;
  otPlan: OtPlanInfo | null;
  rows: OtRow[];
  totals: {
    otHoursSource: number;
    otHoursFromDaysSource: number;
    otAmountComputed: number;
    otIncentiveAmountComputed: number;
    employeesWithOt: number;
  };
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dayTypeColor: Record<string, string> = {
  weekday: '#6b7280',
  weeklyOff: '#2563eb',
  holiday: '#dc2626',
};

export default function OtReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/payroll/ot?year=${year}&month=${month}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load report');
      }
      setData(await res.json());
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

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
    setExpandedRows(new Set(data.rows.filter((r) => r.dailyOtDays > 0).map((r) => r.id)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const handleExport = (detail: boolean) => {
    const params = new URLSearchParams({ year: String(year), month: String(month), format: 'csv' });
    if (detail) params.set('detail', '1');
    window.open(`/api/reports/payroll/ot?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Complete OT Report</h1>
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
            Export Detail CSV
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : data ? (
        <div className="space-y-6">
          {/* OT Plan Config */}
          {data.otPlan && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>OT Plan Config Used</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Plan</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.code}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Basis</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.otBasis}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Rate Multiplier</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.rateMultiplier.toFixed(2)}x</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Threshold (min)</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.applicableAfterMinutes}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Max/Day (hrs)</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.maxOtHoursPerDay ?? 'No cap'}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Max/Week (hrs)</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.maxOtHoursPerWeek ?? 'No cap'}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Max/Month (hrs)</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.otPlan.maxOtHoursPerMonth ?? 'No cap'}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Run Status</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{data.run?.status ?? 'No run'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Employees with OT</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.employeesWithOt}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total OT Hours (Summary)</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.otHoursSource.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total OT Amount (Payroll)</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otAmountComputed)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total OT Incentive (Payroll)</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otIncentiveAmountComputed)}</div>
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

          {/* Monthly Summary Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}></th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Allowed</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Hours<br />(Summary)</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Hours<br />(Per-Day Sum)</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Amount<br />(Payroll)</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Incentive<br />(Payroll)</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Slab Matched</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Line Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                      No employees found for this period.
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
                        onClick={() => r.dailyOtDays > 0 && toggleRow(r.id)}
                      >
                        <td className="px-3 py-3 text-center">
                          {r.dailyOtDays > 0 && (
                            <span className="text-xs" style={{ color: 'var(--accent)' }}>
                              {expandedRows.has(r.id) ? '▼' : '▶'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{r.employeeCode}</td>
                        <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.employeeName}</td>
                        <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.department}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium ${r.overtimeAllowed ? 'text-green-600' : 'text-red-500'}`}>
                            {r.overtimeAllowed ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{r.otHoursSource.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>
                          {r.otHoursFromDaysSource.toFixed(2)}
                          {r.otHoursSource > 0 && Math.abs(r.otHoursSource - r.otHoursFromDaysSource) > 0.01 && (
                            <span className="ml-1 text-xs text-amber-600">⚠</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>{money(r.otAmountComputed)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{money(r.otIncentiveAmountComputed)}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--foreground)' }}>
                          {r.matchedSlabCode ? (
                            <span>
                              {r.matchedSlabCode}
                              {r.matchedSlabType === 'FLAT_BONUS' && r.matchedSlabFlatBonus != null && ` (₹${r.matchedSlabFlatBonus})`}
                              {r.matchedSlabType === 'MULTIPLIER' && r.matchedSlabMultiplier != null && ` (${r.matchedSlabMultiplier}x)`}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium ${r.lineStatus === 'OK' ? 'text-green-600' : 'text-red-500'}`}>
                            {r.lineStatus}
                          </span>
                        </td>
                      </tr>
                      {expandedRows.has(r.id) && r.dailyBreakdown.length > 0 && (
                        <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                          <td colSpan={11} className="px-6 py-3">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Date</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Shift</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>OT Calc (min)</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>OT Approved (min)</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Approval</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Settlement</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Day Type</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Factor</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Payable OT (min)</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Payable OT (hrs)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.dailyBreakdown.map((d, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.date}</td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.shiftCode}</td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.status}</td>
                                      <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.otMinutesCalculated}</td>
                                      <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.otMinutesApproved ?? '—'}</td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.otApprovalStatus}</td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.otSettlementType}</td>
                                      <td className="px-2 py-2">
                                        <span style={{ color: dayTypeColor[d.dayType] ?? 'var(--foreground)' }}>
                                          {d.dayType}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.factorApplied.toFixed(2)}x</td>
                                      <td className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{d.payableOtMinutes}</td>
                                      <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.payableOtHours.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
                    <td className="px-3 py-3" colSpan={5}></td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.otHoursSource.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.otHoursFromDaysSource.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otAmountComputed)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.otIncentiveAmountComputed)}</td>
                    <td colSpan={2}></td>
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
