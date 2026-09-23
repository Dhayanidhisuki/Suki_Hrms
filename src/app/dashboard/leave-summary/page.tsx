/**
 * Dashboard — Leave Summary
 *
 * Visual read of GET /api/reports/leave for a chosen month: the same
 * aggregation the Leave report exports to CSV and PDF, so the dashboard and
 * the report can never show different numbers for the same period.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarDays, CalendarX } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import {
  ReportBarChart,
  ReportChartCard,
  ReportDonutChart,
} from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';

interface LeaveReport {
  period: { year: number; month: number };
  totalApplications: number;
  approved: number;
  pending: number;
  rejected: number;
  byLeaveType: Array<{ leaveType: string; count: number; days: number }>;
  balances: Array<{
    employeeCode: string;
    name: string;
    leaveType: string;
    opening: number;
    accrued: number;
    availed: number;
    closing: number;
  }>;
}

const APPROVED = '#10b981';
const PENDING = '#f59e0b';
const REJECTED = '#f43f5e';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function LeaveSummaryDashboardPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<LeaveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/leave?year=${year}&month=${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leave summary');
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

  // Closing balance left across the company — what is still owed as leave.
  const closingTotal = data?.balances.reduce((sum, b) => sum + b.closing, 0) ?? 0;
  const approvedDays = data?.byLeaveType.reduce((sum, t) => sum + t.days, 0) ?? 0;

  const periodPicker = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        aria-label="Month"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Summary"
        description={`${MONTHS[month - 1]} ${year}`}
        eyebrow="Dashboard"
        actions={periodPicker}
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">{error ?? 'No data returned.'}</p>
        </div>
      ) : (
        <>
          <ModuleKpiRow
            className="mb-0"
            items={[
              {
                id: 'applications',
                label: 'Applications',
                value: data.totalApplications,
                icon: CalendarDays,
                subtext: 'Overlapping this month',
              },
              {
                id: 'approved',
                label: 'Approved',
                value: data.approved,
                icon: CalendarCheck,
                subtext: `${approvedDays} day${approvedDays === 1 ? '' : 's'} granted`,
                badge: data.approved > 0 ? { label: 'Approved', type: 'success' } : undefined,
              },
              {
                id: 'pending',
                label: 'Pending',
                value: data.pending,
                icon: CalendarClock,
                subtext: 'Awaiting manager or HR',
                badge: data.pending > 0 ? { label: 'Action needed', type: 'warning' } : undefined,
              },
              {
                id: 'rejected',
                label: 'Rejected',
                value: data.rejected,
                icon: CalendarX,
                subtext: 'Declined this month',
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <ReportChartCard
              title="Applications by Status"
              subtitle={`${data.totalApplications} in ${MONTHS[month - 1]}`}
              className="mb-0"
              height={300}
            >
              <ReportDonutChart
                data={[
                  { name: 'Approved', value: data.approved, color: APPROVED },
                  { name: 'Pending', value: data.pending, color: PENDING },
                  { name: 'Rejected', value: data.rejected, color: REJECTED },
                ]}
                centerSubtext="applications"
              />
            </ReportChartCard>

            <ReportChartCard
              title="Approved Days by Leave Type"
              subtitle="Only approved applications count toward days"
              className="mb-0"
              height={300}
            >
              <ReportBarChart
                data={data.byLeaveType}
                xKey="leaveType"
                yKey="days"
                horizontal
                categoryWidth={150}
                seriesName="Days"
              />
            </ReportChartCard>
          </div>

          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Leave Balances</h2>
              <span className="text-xs text-[var(--text-muted)]">
                {data.balances.length} row{data.balances.length === 1 ? '' : 's'} · {closingTotal.toFixed(2)} days closing
              </span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {['Emp Code', 'Employee', 'Leave Type', 'Opening', 'Accrued', 'Availed', 'Closing'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] ${i >= 3 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {data.balances.map((b, i) => (
                    <tr key={`${b.employeeCode}-${b.leaveType}-${i}`} className="transition-colors hover:bg-[var(--bg-hover)]">
                      <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{b.employeeCode}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">{b.name}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{b.leaveType}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{b.opening.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{b.accrued.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{b.availed.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">{b.closing.toFixed(2)}</td>
                    </tr>
                  ))}
                  {data.balances.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-[var(--text-muted)]">
                        No leave balances for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
