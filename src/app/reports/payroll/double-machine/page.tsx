/**
 * Complete Double Machine Report — source + computed data side-by-side.
 *
 * Monthly summary per employee with expandable per-day detail.
 * Shows source (DoubleMachineEntry per-day entries, DoubleMachineIncentive
 * legacy manual HR entry) vs computed (PayrollLineComponent DM_INCENTIVE)
 * with reconciliation match/mismatch indicators.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';

interface DmDailyRow {
  id: number;
  date: string;
  machine1: string;
  machine2: string;
  numMachines: number;
  workingHours: number;
  incentiveRate: number;
  calculatedIncentive: number;
  status: string;
  hrRemarks: string | null;
  approvedAt: string | null;
}

interface DmRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  totalEntries: number;
  approvedEntries: number;
  pendingEntries: number;
  rejectedEntries: number;
  totalWorkingHours: number;
  totalApprovedWorkingHours: number;
  totalCalculatedIncentive: number;
  totalApprovedIncentive: number;
  legacyDoubleMachine: number;
  legacyAttendanceBonus: number;
  legacyShiftIncentive: number;
  legacyOtWeeklyInc: number;
  legacyEmployeeR: number;
  legacyStatus: string;
  computedDmIncentive: number;
  computedIsAdhoc: boolean;
  sourceVsComputedDiff: number;
  sourceVsComputedMatch: boolean;
  dailyBreakdown: DmDailyRow[];
}

interface ReportData {
  run: { id: number; year: number; month: number; status: string } | null;
  rows: DmRow[];
  totals: {
    totalEntries: number;
    approvedEntries: number;
    totalWorkingHours: number;
    totalApprovedWorkingHours: number;
    totalCalculatedIncentive: number;
    totalApprovedIncentive: number;
    computedDmIncentive: number;
    legacyDoubleMachine: number;
  };
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColor: Record<string, string> = {
  APPROVED: '#166534',
  PENDING: '#b45309',
  REJECTED: '#dc2626',
};

const legacyStatusColor: Record<string, string> = {
  draft: '#6b7280',
  process: '#b45309',
  hold: '#dc2626',
  complete: '#166534',
};

export default function DoubleMachineReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/payroll/double-machine?year=${year}&month=${month}`);
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
    setExpandedRows(new Set(data.rows.filter((r) => r.totalEntries > 0).map((r) => r.id)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const handleExport = (detail: boolean) => {
    const params = new URLSearchParams({ year: String(year), month: String(month), format: 'csv' });
    if (detail) params.set('detail', '1');
    window.open(`/api/reports/payroll/double-machine?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Complete Double Machine Report</h1>
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

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Employees with DM Entries</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.rows.length}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Approved Incentive (Source)</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.totalApprovedIncentive)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Computed DM Incentive (Payroll)</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.computedDmIncentive)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Source vs Computed Diff</div>
              <div className="text-2xl font-bold" style={{ color: Math.abs(data.totals.totalApprovedIncentive - data.totals.computedDmIncentive) > 1 ? '#dc2626' : '#166534' }}>
                {money(Math.abs(data.totals.totalApprovedIncentive - data.totals.computedDmIncentive))}
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

          {/* Monthly Summary Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}></th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Entries</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Approved</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Pending</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Work Hrs</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Calc Incentive<br />(Source)</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Approved Incentive<br />(Source)</th>
                  <th className="px-3 py-3 text-right font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>DM Incentive<br />(Payroll)</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Match</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Legacy DM</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Legacy Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                      No double machine entries found for this period.
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
                        onClick={() => r.totalEntries > 0 && toggleRow(r.id)}
                      >
                        <td className="px-3 py-3 text-center">
                          {r.totalEntries > 0 && (
                            <span className="text-xs" style={{ color: 'var(--accent)' }}>
                              {expandedRows.has(r.id) ? '▼' : '▶'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{r.employeeCode}</td>
                        <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.employeeName}</td>
                        <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.department}</td>
                        <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.totalEntries}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-medium text-green-600">{r.approvedEntries}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-medium" style={{ color: r.pendingEntries > 0 ? '#b45309' : 'var(--foreground-muted)' }}>{r.pendingEntries}</span>
                        </td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground)' }}>{r.totalWorkingHours.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground-muted)' }}>{money(r.totalCalculatedIncentive)}</td>
                        <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>{money(r.totalApprovedIncentive)}</td>
                        <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>{money(r.computedDmIncentive)}</td>
                        <td className="px-3 py-3 text-center">
                          {r.totalApprovedIncentive > 0 || r.computedDmIncentive > 0 ? (
                            <span className={`text-xs font-bold ${r.sourceVsComputedMatch ? 'text-green-600' : 'text-red-500'}`}>
                              {r.sourceVsComputedMatch ? '✓' : '✗'}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right" style={{ color: 'var(--foreground-muted)' }}>
                          {r.legacyDoubleMachine > 0 ? money(r.legacyDoubleMachine) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.legacyStatus !== '—' ? (
                            <span className="text-xs font-medium" style={{ color: legacyStatusColor[r.legacyStatus] ?? 'var(--foreground)' }}>
                              {r.legacyStatus}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                      {expandedRows.has(r.id) && r.dailyBreakdown.length > 0 && (
                        <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                          <td colSpan={14} className="px-6 py-3">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Date</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Machine 1</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Machine 2</th>
                                    <th className="px-2 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>Num Machines</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Working Hours</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Incentive Rate</th>
                                    <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Calculated Incentive</th>
                                    <th className="px-2 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                                    <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>HR Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.dailyBreakdown.map((d, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.date}</td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.machine1}</td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.machine2}</td>
                                      <td className="px-2 py-2 text-center" style={{ color: 'var(--foreground)' }}>{d.numMachines}</td>
                                      <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.workingHours.toFixed(2)}</td>
                                      <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{money(d.incentiveRate)}</td>
                                      <td className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{money(d.calculatedIncentive)}</td>
                                      <td className="px-2 py-2 text-center">
                                        <span className="text-xs font-medium" style={{ color: statusColor[d.status] ?? 'var(--foreground)' }}>
                                          {d.status}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2" style={{ color: 'var(--foreground-muted)' }}>{d.hrRemarks ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                                    <td colSpan={4} className="px-2 py-2 text-right font-bold" style={{ color: 'var(--foreground)' }}>Totals:</td>
                                    <td className="px-2 py-2 text-right font-bold" style={{ color: 'var(--foreground)' }}>{r.totalWorkingHours.toFixed(2)}</td>
                                    <td></td>
                                    <td className="px-2 py-2 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(r.totalCalculatedIncentive)}</td>
                                    <td colSpan={2}></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            {/* Legacy entry info */}
                            {r.legacyDoubleMachine > 0 && (
                              <div className="mt-3 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
                                <div className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Legacy DoubleMachineIncentive Entry (Manual HR)</div>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-5" style={{ color: 'var(--foreground)' }}>
                                  <div>DM: <span className="font-medium">{money(r.legacyDoubleMachine)}</span></div>
                                  <div>Att Bonus: <span className="font-medium">{money(r.legacyAttendanceBonus)}</span></div>
                                  <div>Shift Inc: <span className="font-medium">{money(r.legacyShiftIncentive)}</span></div>
                                  <div>OT Weekly: <span className="font-medium">{money(r.legacyOtWeeklyInc)}</span></div>
                                  <div>Employee R: <span className="font-medium">{money(r.legacyEmployeeR)}</span></div>
                                </div>
                                <div className="mt-1" style={{ color: 'var(--foreground-muted)' }}>Status: {r.legacyStatus}</div>
                              </div>
                            )}
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
                    <td className="px-3 py-3 text-center font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.totalEntries}</td>
                    <td className="px-3 py-3 text-center font-bold text-green-600">{data.totals.approvedEntries}</td>
                    <td></td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{data.totals.totalWorkingHours.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.totalCalculatedIncentive)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.totalApprovedIncentive)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>{money(data.totals.computedDmIncentive)}</td>
                    <td colSpan={3}></td>
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
