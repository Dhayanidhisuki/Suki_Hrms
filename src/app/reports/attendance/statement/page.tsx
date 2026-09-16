/**
 * Attendance Statement Report — per-employee daily attendance detail
 * for a selected month. Shows date, shift, in/out times, working hours,
 * late/early-out minutes, OT minutes (calc + approved), approval status,
 * settlement type, LOM status, day-type flags, and attendance status.
 * Monthly summary header per employee.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface DailyRow {
  id: number;
  date: string;
  dayOfWeek: string;
  shiftCode: string;
  shiftName: string;
  shiftTime: string;
  status: string;
  inTime: string;
  outTime: string;
  workingMinutes: number;
  workingHours: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  otMinutesCalculated: number;
  otMinutesApproved: number | null;
  otApprovalStatus: string;
  otSettlementType: string;
  lomApprovalStatus: string;
  lomApprovedMinutes: number | null;
  isHolidayWorked: boolean;
  isWeeklyOffWorked: boolean;
  source: string;
  remarks: string | null;
}

interface EmpRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  summary: {
    totalWorkingDays: number;
    payableDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    lopDays: number;
    otMinutesTotal: number;
    lateMinutesTotal: number;
    earlyOutMinutesTotal: number;
    holidayWorkedDays: number;
    permissionHours: number;
    permissionExcessHours: number;
    elDays: number;
    clDays: number;
    slDays: number;
    mlDays: number;
    plDays: number;
    compOffDays: number;
    otherLeaveDays: number;
    status: string;
  } | null;
  dailyBreakdown: DailyRow[];
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  leaveDays: number;
  onDutyDays: number;
  lopDays: number;
  missingPunchDays: number;
  permissionDays: number;
}

interface ReportData {
  period: { year: number; month: number };
  employees: number;
  rows: EmpRow[];
}

const statusColor: Record<string, string> = {
  Present: '#166534',
  Absent: '#dc2626',
  HalfDay: '#b45309',
  WeeklyOff: '#6b7280',
  Holiday: '#7c3aed',
  Leave: '#2563eb',
  OnDuty: '#0891b2',
  LOP: '#dc2626',
  MissingPunch: '#dc2626',
  Permission: '#b45309',
};

export default function AttendanceStatementReportPage() {
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
      const res = await fetch(`/api/reports/attendance/statement?year=${year}&month=${month}`);
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

  useEffect(() => { void fetchData(); }, [fetchData]);

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

  const collapseAll = () => setExpandedRows(new Set());

  const handleExport = () => {
    window.open(`/api/reports/attendance/statement?year=${year}&month=${month}&format=csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Attendance Statement Report</h1>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
          <button onClick={handleExport} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary)' }}>Export CSV</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div> : data ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Expand All</button>
            <button onClick={collapseAll} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Collapse All</button>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{data.employees} employees</span>
          </div>

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}></th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Code</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Name</th>
                  <th className="px-3 py-3 text-left font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Dept</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Days</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Present</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Absent</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>LOP</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>W/Off</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Holiday</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>OT Min</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Late Min</th>
                  <th className="px-3 py-3 text-center font-medium text-xs" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={14} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>No attendance records for this period.</td></tr>
                ) : data.rows.map((r) => (
                  <>
                    <tr key={r.id} className="transition-colors cursor-pointer" style={{ borderTop: '1px solid var(--border)' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} onClick={() => toggleRow(r.id)}>
                      <td className="px-3 py-3 text-center"><span className="text-xs" style={{ color: 'var(--accent)' }}>{expandedRows.has(r.id) ? '▼' : '▶'}</span></td>
                      <td className="px-3 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{r.employeeCode}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.employeeName}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--foreground)' }}>{r.department}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.totalDays}</td>
                      <td className="px-3 py-3 text-center text-green-600">{r.presentDays}</td>
                      <td className="px-3 py-3 text-center text-red-500">{r.absentDays}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.leaveDays}</td>
                      <td className="px-3 py-3 text-center text-red-500">{r.lopDays}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground-muted)' }}>{r.weeklyOffDays}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground-muted)' }}>{r.holidayDays}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.summary?.otMinutesTotal ?? 0}</td>
                      <td className="px-3 py-3 text-center" style={{ color: 'var(--foreground)' }}>{r.summary?.lateMinutesTotal ?? 0}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium" style={{ color: r.summary?.status === 'FINALIZED' ? '#166534' : r.summary?.status === 'FROZEN' ? '#dc2626' : '#b45309' }}>
                          {r.summary?.status ?? '—'}
                        </span>
                      </td>
                    </tr>
                    {expandedRows.has(r.id) && (
                      <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <td colSpan={14} className="px-6 py-3">
                          {/* Monthly summary */}
                          {r.summary && (
                            <div className="mb-3 grid grid-cols-4 gap-2 md:grid-cols-8 text-xs">
                              <div><span style={{ color: 'var(--foreground-muted)' }}>WD:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.totalWorkingDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>PD:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.payableDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>LOP:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.lopDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>EL:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.elDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>CL:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.clDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>SL:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.slDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>CompOff:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.compOffDays}</span></div>
                              <div><span style={{ color: 'var(--foreground-muted)' }}>Holiday Worked:</span> <span style={{ color: 'var(--foreground)' }}>{r.summary.holidayWorkedDays}</span></div>
                            </div>
                          )}
                          {/* Daily detail */}
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Date</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Day</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Shift</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>In</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Out</th>
                                  <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Hrs</th>
                                  <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Late</th>
                                  <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>Early</th>
                                  <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>OT Calc</th>
                                  <th className="px-2 py-2 text-right font-medium" style={{ color: 'var(--foreground-muted)' }}>OT Appr</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Approval</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>Settlement</th>
                                  <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>LOM</th>
                                  <th className="px-2 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>H/W</th>
                                  <th className="px-2 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>WO/W</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.dailyBreakdown.map((d, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.date}</td>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground-muted)' }}>{d.dayOfWeek}</td>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.shiftCode}</td>
                                    <td className="px-2 py-2"><span style={{ color: statusColor[d.status] ?? 'var(--foreground)' }}>{d.status}</span></td>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.inTime}</td>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.outTime}</td>
                                    <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.workingHours.toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right" style={{ color: d.lateMinutes > 0 ? '#dc2626' : 'var(--foreground-muted)' }}>{d.lateMinutes}</td>
                                    <td className="px-2 py-2 text-right" style={{ color: d.earlyOutMinutes > 0 ? '#dc2626' : 'var(--foreground-muted)' }}>{d.earlyOutMinutes}</td>
                                    <td className="px-2 py-2 text-right" style={{ color: d.otMinutesCalculated > 0 ? '#166534' : 'var(--foreground-muted)' }}>{d.otMinutesCalculated}</td>
                                    <td className="px-2 py-2 text-right" style={{ color: 'var(--foreground)' }}>{d.otMinutesApproved ?? '—'}</td>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.otApprovalStatus}</td>
                                    <td className="px-2 py-2" style={{ color: 'var(--foreground)' }}>{d.otSettlementType}</td>
                                    <td className="px-2 py-2" style={{ color: d.lomApprovalStatus !== '—' && d.lomApprovalStatus !== 'not_applicable' ? '#b45309' : 'var(--foreground-muted)' }}>
                                      {d.lomApprovalStatus !== '—' ? `${d.lomApprovalStatus}${d.lomApprovedMinutes ? ` (${d.lomApprovedMinutes})` : ''}` : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-center" style={{ color: d.isHolidayWorked ? '#7c3aed' : 'var(--foreground-muted)' }}>{d.isHolidayWorked ? '✓' : '—'}</td>
                                    <td className="px-2 py-2 text-center" style={{ color: d.isWeeklyOffWorked ? '#2563eb' : 'var(--foreground-muted)' }}>{d.isWeeklyOffWorked ? '✓' : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
