/**
 * Dashboard — Salary
 *
 * Our build of the legacy "HRMS (Salary Details)" Power BI report. Everything
 * comes from one call to /api/dashboard/salary-bi, so the slicers resolve
 * without a refetch and no two visuals can disagree about the same period.
 *
 * Two deliberate departures from the legacy report, both noted on the page:
 *  - salary bands count distinct employees, not payslip rows
 *  - the canteen card is labelled by the component's own type
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Banknote, Clock, PlayCircle, TrendingUp, UtensilsCrossed, Wallet } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import {
  ReportAreaChart,
  ReportBarChart,
  ReportChartCard,
  ReportDonutChart,
} from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';
import { MONTH_NAMES, inr, inrShort } from '@/lib/payrollSummaryTypes';

interface DeptRow {
  department: string;
  gross: number;
  ot: number;
  performance: number;
  net: number;
  employees: number;
}

interface EmpRow {
  employeeCode: string;
  name: string;
  department: string;
  gross: number;
  pf: number;
  esi: number;
  professionalTax: number;
  totalDeductions: number;
  net: number;
  runStatus: string | null;
}

interface ActivityItem {
  label: string;
  timestamp: string;
  status: string | null;
}

const RUN_STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f3f4f6', fg: '#4b5563' },
  CALCULATED: { bg: '#e0e7ff', fg: '#3730a3' },
  VALIDATED: { bg: '#dbeafe', fg: '#1e40af' },
  SUBMITTED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  LOCKED: { bg: '#ede9fe', fg: '#5b21b6' },
  POSTED: { bg: '#dcfce7', fg: '#166534' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

interface SalaryBi {
  period: { year: number; month: number | null; includeLeavers: boolean };
  units: string[];
  departments: string[];
  cards: {
    totalGross: number;
    totalNet: number;
    overtime: number;
    performance: number;
    highestPaidDepartment: { department: string; amount: number } | null;
    lowestPaidDepartment: { department: string; amount: number } | null;
    canteen: { name: string; type: string; amount: number } | null;
  };
  byDepartment: DeptRow[];
  bands: Array<{ label: string; employees: number }>;
  topEmployees: EmpRow[];
  breakdown: EmpRow[];
  byYear: Array<{ year: string; gross: number }>;
  components: Array<{ name: string; type: string; amount: number }>;
  monthlyTrend: Array<{ label: string; year: number; month: number; gross: number }>;
  composition: {
    net: number;
    pf: number;
    esi: number;
    professionalTax: number;
    tds: number;
    other: number;
  } | null;
  recentActivity: ActivityItem[];
}

const OT_COLORS = ['#6d4aff', '#38bdf8', '#a3e635', '#f59e0b', '#f43f5e'];
const SELECT_CLASS =
  'h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]';

export default function SalaryBiPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | ''>('');
  const [includeLeavers, setIncludeLeavers] = useState(false);
  const [department, setDepartment] = useState('All');
  const [data, setData] = useState<SalaryBi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (month) params.set('month', String(month));
      if (includeLeavers) params.set('exit', 'include');
      const res = await fetch(`/api/dashboard/salary-bi?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the salary dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, includeLeavers]);

  useEffect(() => {
    // The fetch flips `loading` on entry, which is the point: that state is
    // what drives the spinner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  // Department is a client-side scope filter, so switching it costs no request.
  const scoped = useMemo(() => {
    if (!data) return null;
    if (department === 'All') return data;
    return {
      ...data,
      byDepartment: data.byDepartment.filter((d) => d.department === department),
      topEmployees: data.breakdown.filter((e) => e.department === department).slice(0, 10),
      breakdown: data.breakdown.filter((e) => e.department === department),
    };
  }, [data, department]);

  const periodLabel = month ? `${MONTH_NAMES[Number(month) - 1]} ${year}` : `${year}`;

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year" className={SELECT_CLASS}>
        {[0, 1, 2, 3].map((back) => {
          const y = now.getFullYear() - back;
          return <option key={y} value={y}>{y}</option>;
        })}
      </select>

      <select
        value={month}
        onChange={(e) => setMonth(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label="Month"
        className={SELECT_CLASS}
      >
        <option value="">Whole year</option>
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>

      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        aria-label="Department"
        className={SELECT_CLASS}
      >
        <option value="All">All Departments</option>
        {(data?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <button
        type="button"
        onClick={() => setIncludeLeavers((v) => !v)}
        aria-pressed={includeLeavers}
        className={`h-9 cursor-pointer rounded-lg border px-3 text-[12px] font-semibold transition-colors ${
          includeLeavers
            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
            : 'border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
        }`}
      >
        Include leavers
      </button>

      <Link
        href="/payroll/processing/salary"
        className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <PlayCircle size={14} />
        Run Payroll
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Dashboard"
        description={`${periodLabel} · ${includeLeavers ? 'active and past employees' : 'active employees'}`}
        eyebrow="Dashboard"
        actions={filters}
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
      ) : error || !scoped ? (
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">{error ?? 'No payroll data for this period.'}</p>
        </div>
      ) : (
        <>
          <ModuleKpiRow
            className="mb-0"
            columns={5}
            items={[
              {
                id: 'gross',
                label: 'Total Gross',
                value: inrShort(scoped.cards.totalGross),
                icon: Wallet,
                subtext: `${inrShort(scoped.cards.totalNet)} net paid`,
              },
              {
                id: 'highest',
                label: 'Highest Paid Department',
                value: scoped.cards.highestPaidDepartment
                  ? inrShort(scoped.cards.highestPaidDepartment.amount)
                  : '—',
                icon: TrendingUp,
                subtext: scoped.cards.highestPaidDepartment?.department ?? 'No payroll',
              },
              {
                id: 'lowest',
                label: 'Lowest Paid Department',
                value: scoped.cards.lowestPaidDepartment
                  ? inrShort(scoped.cards.lowestPaidDepartment.amount)
                  : '—',
                icon: Banknote,
                subtext: scoped.cards.lowestPaidDepartment?.department ?? 'No payroll',
              },
              {
                id: 'ot',
                label: 'Overtime',
                value: inrShort(scoped.cards.overtime),
                icon: Clock,
                subtext: `${inrShort(scoped.cards.performance)} performance incentive`,
              },
              {
                id: 'canteen',
                label: scoped.cards.canteen?.name ?? 'Canteen',
                value: scoped.cards.canteen ? inrShort(scoped.cards.canteen.amount) : '—',
                icon: UtensilsCrossed,
                // Labelled from the component's own type rather than assumed:
                // the master holds both a canteen earning and a canteen
                // deduction, and only one of them is in use.
                subtext: scoped.cards.canteen
                  ? `Salary component · ${scoped.cards.canteen.type}`
                  : 'No canteen component posted',
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportChartCard
              title="Payroll Trend (Last 6 Months)"
              subtitle="Total gross · all departments"
              className="mb-0"
              height={260}
            >
              <ReportAreaChart
                data={scoped.monthlyTrend}
                xKey="label"
                yKey="gross"
                seriesName="Gross"
                valueFormatter={inr}
                axisFormatter={inrShort}
              />
            </ReportChartCard>

            <ReportChartCard
              title="Salary Breakdown"
              subtitle={`${periodLabel} · net vs everything withheld`}
              className="mb-0"
              height={260}
            >
              {scoped.composition ? (
                <ReportDonutChart
                  data={[
                    { name: 'Net Salary', value: Math.round(scoped.composition.net), color: '#10b981' },
                    { name: 'PF', value: Math.round(scoped.composition.pf), color: '#6d4aff' },
                    { name: 'ESI', value: Math.round(scoped.composition.esi), color: '#38bdf8' },
                    { name: 'Prof. Tax', value: Math.round(scoped.composition.professionalTax), color: '#f59e0b' },
                    { name: 'TDS', value: Math.round(scoped.composition.tds), color: '#f43f5e' },
                    { name: 'Other Deductions', value: Math.round(scoped.composition.other), color: '#94a3b8' },
                  ]}
                  centerLabel={inrShort(scoped.cards.totalGross)}
                  centerSubtext="gross"
                  showBadges={false}
                />
              ) : null}
            </ReportChartCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportChartCard
              title="Gross Salary by Department"
              subtitle={periodLabel}
              className="mb-0"
              height={300}
            >
              <ReportBarChart
                data={scoped.byDepartment}
                xKey="department"
                yKey="gross"
                horizontal
                categoryWidth={150}
                seriesName="Gross"
                valueFormatter={inr}
                axisFormatter={inrShort}
              />
            </ReportChartCard>

            <ReportChartCard
              title="Top Departments by Overtime"
              subtitle="Share of OT paid"
              className="mb-0"
              height={300}
            >
              <ReportDonutChart
                data={[...scoped.byDepartment]
                  .filter((d) => d.ot > 0)
                  .sort((a, b) => b.ot - a.ot)
                  .slice(0, 5)
                  .map((d, i) => ({ name: d.department, value: Math.round(d.ot), color: OT_COLORS[i] }))}
                centerLabel={inrShort(scoped.cards.overtime)}
                centerSubtext="overtime"
                showBadges={false}
              />
            </ReportChartCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ReportChartCard
              title="Employees by Salary Band"
              // Stated on the card because it is the one figure that will not
              // tie back to the legacy report, which counts payslip rows.
              subtitle="Distinct employees, not payslips"
              className="mb-0"
            >
              <ReportBarChart
                data={scoped.bands}
                xKey="label"
                yKey="employees"
                horizontal
                categoryWidth={150}
                seriesName="Employees"
              />
            </ReportChartCard>

            <ReportChartCard title="Gross Salary by Year" subtitle="All payroll runs" className="mb-0">
              <ReportBarChart
                data={scoped.byYear}
                xKey="year"
                yKey="gross"
                seriesName="Gross"
                valueFormatter={inr}
                axisFormatter={inrShort}
                yAxisWidth={62}
              />
            </ReportChartCard>
          </div>

          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Top 10 Employees by Gross Salary</h2>
              <span className="text-xs text-[var(--text-muted)]">{periodLabel}</span>
            </div>
            <SalaryTable rows={scoped.topEmployees} compact />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Salary Breakdown</h2>
                <span className="text-xs text-[var(--text-muted)]">
                  {scoped.breakdown.length} employee{scoped.breakdown.length === 1 ? '' : 's'}
                </span>
              </div>
              <SalaryTable rows={scoped.breakdown} showStatus={!!month} />
            </div>

            <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h2>
              </div>
              {scoped.recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">No recent activity.</p>
              ) : (
                <ul className="space-y-3">
                  {scoped.recentActivity.map((a, i) => {
                    const tone = a.status ? RUN_STATUS_TONE[a.status] : null;
                    return (
                      <li key={i} className="flex items-start justify-between gap-3 border-b border-[var(--border-main)] pb-3 last:border-0 last:pb-0">
                        <span className="text-xs text-[var(--text-secondary)]">{a.label}</span>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {tone && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
                              {a.status}
                            </span>
                          )}
                          <span className="text-[11px] text-[var(--text-muted)]">{timeAgo(a.timestamp)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The legacy report's "Breakage": gross through to net, per employee. */
function SalaryTable({ rows, compact = false, showStatus = false }: { rows: EmpRow[]; compact?: boolean; showStatus?: boolean }) {
  const cols = compact
    ? ['Emp Code', 'Employee', 'Department', 'Gross']
    : ['Emp Code', 'Employee', 'Department', 'Gross', 'PF', 'ESI', 'Prof. Tax', 'Total Ded.', 'Net'];
  if (!compact && showStatus) cols.push('Status');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
            {cols.map((c, i) => (
              <th
                key={c}
                className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] ${i >= 3 && c !== 'Status' ? 'text-right' : i === cols.length - 1 && c === 'Status' ? 'text-center' : 'text-left'}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-main)]">
          {rows.map((e) => {
            const tone = e.runStatus ? RUN_STATUS_TONE[e.runStatus] : null;
            return (
              <tr key={e.employeeCode + e.name} className="transition-colors hover:bg-[var(--bg-hover)]">
                <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{e.employeeCode}</td>
                <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">{e.name}</td>
                <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{e.department}</td>
                <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">{inr(e.gross)}</td>
                {!compact && (
                  <>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.pf)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.esi)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.professionalTax)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.totalDeductions)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">{inr(e.net)}</td>
                    {showStatus && (
                      <td className="px-3 py-2.5 text-center">
                        {tone ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
                            {e.runStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="py-10 text-center text-sm text-[var(--text-muted)]">
                No payroll lines for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
