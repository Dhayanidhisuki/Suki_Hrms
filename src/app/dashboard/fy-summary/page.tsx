/**
 * Dashboard — Financial Year Summary
 *
 * The cross-tab view the legacy SUKI ERP HRMS dashboard is built around:
 * every measure by department across the 12 months of an Indian financial
 * year (April → March), each grid paired with its chart.
 *
 * All seven measures come from one call to /api/dashboard/fy-crosstab, so the
 * measure tabs and the unit filter resolve client-side without a refetch.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, Spinner } from '@/components/ui';
import { CrossTabTable } from '@/components/ui/CrossTabTable';
import { ReportChartCard, ReportGroupedBarChart } from '@/components/ui/ReportCharts';
import { inr, inrShort } from '@/lib/payrollSummaryTypes';

type GroupBy = 'department' | 'unit' | 'employee';

interface CrossTabRow {
  label: string;
  department: string;
  unit: string;
  employee: string;
  values: number[];
}

interface FyCrossTab {
  fy: number;
  fyLabel: string;
  groupBy: GroupBy;
  months: string[];
  departments: string[];
  units: string[];
  measures: Record<MeasureKey, CrossTabRow[]>;
}

type MeasureKey =
  | 'salary'
  | 'employees'
  | 'overtime'
  | 'leave'
  | 'pf'
  | 'esi'
  | 'salaryPerEmployee';

const nf = (n: number) => (n === 0 ? '0' : n.toLocaleString('en-IN'));

const MEASURES: Array<{
  key: MeasureKey;
  title: string;
  subtitle: string;
  money: boolean;
}> = [
  { key: 'salary', title: 'Total Salary by Department', subtitle: 'Gross earnings per month', money: true },
  { key: 'employees', title: 'No. of Employees by Department', subtitle: 'Employees in each month’s payroll run', money: false },
  { key: 'overtime', title: 'Overtime Amount by Department', subtitle: 'OT paid per month', money: true },
  { key: 'leave', title: 'No. of Leave by Department', subtitle: 'Approved leave applications per month', money: false },
  { key: 'pf', title: 'Employee PF by Department', subtitle: 'Employee share only', money: true },
  { key: 'esi', title: 'Employee ESI by Department', subtitle: 'Employee share only', money: true },
  { key: 'salaryPerEmployee', title: 'Salary vs Employee by Department', subtitle: 'Average gross per employee per month', money: true },
];

const ALL = 'All';

const LABEL_HEADER: Record<GroupBy, string> = {
  department: 'Department',
  unit: 'Unit',
  employee: 'Employee',
};

export default function FySummaryPage() {
  const now = useMemo(() => new Date(), []);
  // Before April the current FY still started in the previous calendar year.
  const defaultFy = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;

  const [fy, setFy] = useState(defaultFy);
  const [groupBy, setGroupBy] = useState<GroupBy>('department');
  const [unit, setUnit] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [fromMonth, setFromMonth] = useState(0);
  const [toMonth, setToMonth] = useState(11);
  const [data, setData] = useState<FyCrossTab | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/fy-crosstab?fy=${fy}&groupBy=${groupBy}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the financial year summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fy, groupBy]);

  useEffect(() => {
    // The fetch flips `loading` on entry, which is the point: that state is
    // what drives the spinner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const lo = Math.min(fromMonth, toMonth);
  const hi = Math.max(fromMonth, toMonth);
  const months = data?.months.slice(lo, hi + 1) ?? [];

  /** Collapse the unit dimension and clip to the chosen month window. */
  const shape = useCallback(
    (rows: CrossTabRow[] | undefined) => {
      if (!rows) return [];
      const byLabel = new Map<string, number[]>();
      for (const r of rows) {
        if (unit !== ALL && r.unit !== unit) continue;
        if (department !== ALL && r.department !== department) continue;
        const existing = byLabel.get(r.label) ?? Array(12).fill(0);
        r.values.forEach((v, i) => { existing[i] += v; });
        byLabel.set(r.label, existing);
      }
      return Array.from(byLabel.entries())
        .map(([label, values]) => ({ label, values: values.slice(lo, hi + 1) }))
        // A row that is zero across the whole window is noise on a chart with
        // one series per row, so it is dropped rather than drawn flat.
        .filter((r) => r.values.some((v) => v !== 0))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    [unit, department, lo, hi]
  );

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={fy}
        onChange={(e) => setFy(Number(e.target.value))}
        aria-label="Financial year"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        {[0, 1, 2, 3].map((back) => {
          const y = defaultFy - back;
          return <option key={y} value={y}>{`${y}-${y + 1}`}</option>;
        })}
      </select>

      <div className="inline-flex rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] p-0.5">
        {(['department', 'unit', 'employee'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroupBy(g)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
              groupBy === g
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        aria-label="Department"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        <option value={ALL}>All Departments</option>
        {(data?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        aria-label="Unit"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        <option value={ALL}>All Units</option>
        {(data?.units ?? []).map((u) => <option key={u} value={u}>{u}</option>)}
      </select>

      <select
        value={fromMonth}
        onChange={(e) => setFromMonth(Number(e.target.value))}
        aria-label="From month"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        {(data?.months ?? []).map((m, i) => <option key={m} value={i}>{`From ${m}`}</option>)}
      </select>

      <select
        value={toMonth}
        onChange={(e) => setToMonth(Number(e.target.value))}
        aria-label="To month"
        className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
      >
        {(data?.months ?? []).map((m, i) => <option key={m} value={i}>{`To ${m}`}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Year Summary"
        description={
          data
            ? `${data.fyLabel} · by ${groupBy}${department === ALL ? '' : ` · ${department}`}${unit === ALL ? '' : ` · ${unit}`}`
            : 'Month-wise cross-tab by department'
        }
        eyebrow="Dashboard"
        actions={filters}
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">{error ?? 'No data returned.'}</p>
        </div>
      ) : (
        MEASURES.map((m) => {
          const rows = shape(data.measures[m.key]);
          const fmt = m.money ? inr : nf;
          return (
            <section key={m.key} className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">{m.title}</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{m.subtitle}</p>
                </div>
                <CrossTabTable
                  columns={months}
                  rows={rows}
                  formatValue={fmt}
                  labelHeader={LABEL_HEADER[groupBy]}
                />
              </div>

              <ReportChartCard
                title={`${m.title} — chart`}
                subtitle={`One series per ${groupBy}`}
                className="mb-0"
                height={320}
              >
                <ReportGroupedBarChart
                  columns={months}
                  series={rows.map((r) => ({ name: r.label, values: r.values }))}
                  valueFormatter={m.money ? inr : undefined}
                  axisFormatter={m.money ? inrShort : undefined}
                />
              </ReportChartCard>
            </section>
          );
        })
      )}
    </div>
  );
}
