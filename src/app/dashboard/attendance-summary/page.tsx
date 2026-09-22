/**
 * Dashboard — Attendance Summary
 *
 * Reads GET /api/reports/attendance-summary, which aggregates
 * MonthlyAttendanceSummary for the chosen period. That table is written when a
 * month is processed, so a month that has not been run yet legitimately has no
 * rows — the page says so rather than showing zeroes that look like real ones.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Clock, TimerOff, UserX } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import {
  ReportBarChart,
  ReportChartCard,
  ReportDonutChart,
} from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';

interface AttendanceSummaryReport {
  period: { year: number; month: number };
  headcount: number;
  totals: {
    totalWorkingDays: number;
    payableDays: number;
    lopDays: number;
    otMinutesTotal: number;
    lateMinutesTotal: number;
    earlyOutMinutesTotal: number;
    permissionHours: number;
    permissionExcessHours: number;
    holidayWorkedDays: number;
  };
  byDepartment: Array<{
    department: string;
    count: number;
    lopDays: number;
    otMinutes: number;
    lateMinutes: number;
  }>;
  employees: Array<{
    employeeCode: string;
    name: string;
    totalWorkingDays: number;
    payableDays: number;
    lopDays: number;
    otMinutes: number;
    lateMinutes: number;
    earlyOutMinutes: number;
    status: string;
  }>;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PAYABLE = '#10b981';
const LOP = '#f43f5e';
const OT = '#6d4aff';

/** Minutes read as hours once they run to hundreds, which they do monthly. */
function hrs(minutes: number) {
  if (minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AttendanceSummaryDashboardPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<AttendanceSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/attendance-summary?year=${year}&month=${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load attendance summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    // The fetch flips `loading` on entry, which is the point: that state is
    // what drives the spinner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const periodPicker = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        aria-label="Month"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        aria-label="Year"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        {[0, 1, 2, 3].map((back) => {
          const y = now.getFullYear() - back;
          return <option key={y} value={y}>{y}</option>;
        })}
      </select>
    </div>
  );

  const t = data?.totals;
  const hasRows = (data?.headcount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Summary"
        description={`${MONTHS[month - 1]} ${year} · from processed monthly attendance`}
        eyebrow="Dashboard"
        actions={periodPicker}
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
        </div>
      ) : !hasRows || !t || !data ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-main)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No monthly attendance processed for {MONTHS[month - 1]} {year}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            This page reads the monthly attendance summary, which is written when the
            month is processed under Workforce › Attendance. Pick another month, or
            process this one first.
          </p>
        </div>
      ) : (
        <>
          <ModuleKpiRow
            className="mb-0"
            items={[
              {
                id: 'payable',
                label: 'Payable Days',
                value: Number(t.payableDays.toFixed(1)),
                icon: CalendarCheck,
                subtext: `of ${t.totalWorkingDays} working days`,
              },
              {
                id: 'lop',
                label: 'LOP Days',
                value: Number(t.lopDays.toFixed(1)),
                icon: UserX,
                subtext: 'Loss of pay across the company',
                badge: t.lopDays > 0 ? { label: 'Unpaid', type: 'danger' } : undefined,
              },
              {
                id: 'ot',
                label: 'Overtime',
                value: hrs(t.otMinutesTotal),
                icon: Clock,
                subtext: 'Total OT recorded this month',
              },
              {
                id: 'late',
                label: 'Late + Early Out',
                value: hrs(t.lateMinutesTotal + t.earlyOutMinutesTotal),
                icon: TimerOff,
                subtext: `${hrs(t.lateMinutesTotal)} late · ${hrs(t.earlyOutMinutesTotal)} early`,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportChartCard
              title="LOP Days by Department"
              subtitle={`${data.headcount} employee${data.headcount === 1 ? '' : 's'} processed`}
              className="mb-0"
              height={300}
            >
              <ReportBarChart
                data={data.byDepartment}
                xKey="department"
                yKey="lopDays"
                horizontal
                categoryWidth={150}
                color={LOP}
                seriesName="LOP days"
              />
            </ReportChartCard>

            <ReportChartCard
              title="Working Days Split"
              subtitle="Payable against loss of pay"
              className="mb-0"
              height={300}
            >
              <ReportDonutChart
                data={[
                  { name: 'Payable', value: Math.round(t.payableDays), color: PAYABLE },
                  { name: 'LOP', value: Math.round(t.lopDays), color: LOP },
                ]}
                centerLabel={Math.round(t.totalWorkingDays)}
                centerSubtext="working days"
                showBadges={false}
              />
            </ReportChartCard>
          </div>

          <ReportChartCard
            title="Overtime Minutes by Department"
            subtitle="Total OT recorded against each department"
            className="mb-0"
          >
            <ReportBarChart
              data={data.byDepartment}
              xKey="department"
              yKey="otMinutes"
              color={OT}
              seriesName="OT minutes"
            />
          </ReportChartCard>

          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Employee Breakdown</h2>
              <span className="text-xs text-[var(--text-muted)]">{data.employees.length} employees</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {['Emp Code', 'Employee', 'Working', 'Payable', 'LOP', 'OT', 'Late', 'Early Out', 'Status'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] ${i >= 2 && i <= 7 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {data.employees.map((e) => (
                    <tr key={e.employeeCode} className="transition-colors hover:bg-[var(--bg-hover)]">
                      <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{e.employeeCode}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">{e.name}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{e.totalWorkingDays}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{e.payableDays.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums" style={{ color: e.lopDays > 0 ? LOP : 'var(--text-secondary)' }}>
                        {e.lopDays.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{hrs(e.otMinutes)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{hrs(e.lateMinutes)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{hrs(e.earlyOutMinutes)}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
