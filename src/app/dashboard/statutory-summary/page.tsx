/**
 * Dashboard — Statutory Summary
 *
 * The employer's statutory liability for one payroll run, read from
 * GET /api/reports/payroll-summary. Employee and employer shares are kept
 * apart throughout: only their sum is remitted, but only the employer share is
 * a cost to the company, and collapsing them hides which is which.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, PiggyBank, ReceiptIndianRupee, ShieldPlus } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import {
  ReportChartCard,
  ReportDonutChart,
  ReportStackedBarChart,
} from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';
import {
  MONTH_NAMES,
  inr,
  inrShort,
  type PayrollSummaryReport,
} from '@/lib/payrollSummaryTypes';

/** One row of the per-employee statutory breakdown — the legacy "Breakage". */
interface BreakdownRow {
  employeeCode: string;
  name: string;
  department: string;
  gross: number;
  pf: number;
  esi: number;
  professionalTax: number;
  totalDeductions: number;
  net: number;
}

const EMPLOYEE_COLOR = '#6d4aff';
const EMPLOYER_COLOR = '#a3e635';

export default function StatutorySummaryDashboardPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PayrollSummaryReport | null>(null);
  // A1: the company-wide totals above answer "what do we remit"; this answers
  // "who did it come from". Read from the salary dashboard's endpoint rather
  // than adding a second per-employee aggregation.
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/payroll-summary?year=${year}&month=${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);

      const bdRes = await fetch(`/api/dashboard/salary-bi?year=${year}&month=${month}`);
      // A missing breakdown must not blank the statutory totals, which are the
      // point of the page — so this failure is swallowed to an empty table.
      setBreakdown(bdRes.ok ? ((await bdRes.json()).breakdown ?? []) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load statutory summary');
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
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
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

  const heads = t
    ? [
        { head: 'Provident Fund', employee: t.pfEmployee, employer: t.pfEmployer },
        { head: 'ESI', employee: t.esiEmployee, employer: t.esiEmployer },
        { head: 'Professional Tax', employee: t.professionalTax, employer: 0 },
        { head: 'TDS', employee: t.tds, employer: 0 },
        { head: 'LWF', employee: t.lwfAmount, employer: 0 },
      ]
    : [];

  const employeeTotal = heads.reduce((s, h) => s + h.employee, 0);
  const employerTotal = heads.reduce((s, h) => s + h.employer, 0);
  const grandTotal = employeeTotal + employerTotal;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Summary"
        description={`${MONTH_NAMES[month - 1]} ${year} · payable to authorities`}
        eyebrow="Dashboard"
        actions={periodPicker}
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
      ) : error || !data || !t ? (
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">
            {error ?? 'No payroll run for this period.'}
          </p>
        </div>
      ) : (
        <>
          <ModuleKpiRow
            className="mb-0"
            items={[
              {
                id: 'total',
                label: 'Total Remittance',
                value: inrShort(grandTotal),
                icon: Landmark,
                subtext: `Run #${data.run.id} · ${data.run.status}`,
              },
              {
                id: 'pf',
                label: 'Provident Fund',
                value: inrShort(t.pfEmployee + t.pfEmployer),
                icon: PiggyBank,
                subtext: `${inrShort(t.pfEmployee)} employee · ${inrShort(t.pfEmployer)} employer`,
              },
              {
                id: 'esi',
                label: 'ESI',
                value: inrShort(t.esiEmployee + t.esiEmployer),
                icon: ShieldPlus,
                subtext: `${inrShort(t.esiEmployee)} employee · ${inrShort(t.esiEmployer)} employer`,
              },
              {
                id: 'tax',
                label: 'PT + TDS',
                value: inrShort(t.professionalTax + t.tds),
                icon: ReceiptIndianRupee,
                subtext: `${inrShort(t.professionalTax)} PT · ${inrShort(t.tds)} TDS`,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportChartCard
              title="Employee vs Employer Share"
              subtitle="Stacked per statutory head"
              className="mb-0"
              height={300}
            >
              <ReportStackedBarChart
                data={heads}
                xKey="head"
                series={[
                  { key: 'employee', name: 'Employee', color: EMPLOYEE_COLOR },
                  { key: 'employer', name: 'Employer', color: EMPLOYER_COLOR },
                ]}
              />
            </ReportChartCard>

            <ReportChartCard
              title="Share of Total"
              subtitle="Who bears the liability"
              className="mb-0"
              height={300}
            >
              <ReportDonutChart
                data={[
                  { name: 'Employee', value: Math.round(employeeTotal), color: EMPLOYEE_COLOR },
                  { name: 'Employer', value: Math.round(employerTotal), color: EMPLOYER_COLOR },
                ]}
                centerLabel={inrShort(grandTotal)}
                centerSubtext="remittance"
                showBadges={false}
              />
            </ReportChartCard>
          </div>

          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Per-Employee Breakdown</h2>
              <span className="text-xs text-[var(--text-muted)]">
                {breakdown.length} employee{breakdown.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {['Emp Code', 'Employee', 'Department', 'Gross', 'PF', 'ESI', 'Prof. Tax', 'Total Ded.', 'Net'].map((h, i) => (
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
                  {breakdown.map((e) => (
                    <tr key={e.employeeCode + e.name} className="transition-colors hover:bg-[var(--bg-hover)]">
                      <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{e.employeeCode}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">{e.name}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{e.department}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.gross)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.pf)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.esi)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.professionalTax)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">{inr(e.totalDeductions)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">{inr(e.net)}</td>
                    </tr>
                  ))}
                  {breakdown.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-[var(--text-muted)]">
                        No per-employee lines for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Statutory Heads</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Head</th>
                  {['Employee', 'Employer', 'Total'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {heads.map((h) => (
                  <tr key={h.head} className="transition-colors hover:bg-[var(--bg-hover)]">
                    <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{h.head}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-primary)]">{inr(h.employee)}</td>
                    {/* An em dash, not ₹0: these heads have no employer share at all. */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-primary)]">
                      {h.employer > 0 ? inr(h.employer) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">{inr(h.employee + h.employer)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-3 pt-3 text-xs font-bold text-[var(--text-primary)]">Total</td>
                  <td className="px-3 pt-3 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">{inr(employeeTotal)}</td>
                  <td className="px-3 pt-3 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">{inr(employerTotal)}</td>
                  <td className="px-3 pt-3 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">{inr(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
