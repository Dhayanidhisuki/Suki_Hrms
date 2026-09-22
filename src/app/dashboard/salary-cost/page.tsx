/**
 * Dashboard — Salary Cost
 *
 * Visual read of GET /api/reports/payroll-summary for one payroll run. Only
 * OK lines are aggregated by that endpoint, so HOLD employees are reported
 * separately rather than silently inflating the cost.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Clock, Users, Wallet } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import {
  ReportBarChart,
  ReportChartCard,
  ReportDonutChart,
} from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';
import {
  MONTH_NAMES,
  inr,
  inrShort,
  type PayrollSummaryReport,
} from '@/lib/payrollSummaryTypes';

export default function SalaryCostDashboardPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PayrollSummaryReport | null>(null);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load salary cost');
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
  // Gross minus net is everything withheld, whatever the individual heads.
  const totalDeductions = t ? t.grossEarnings - t.netSalary : 0;
  const perHead = t && data && data.headcount.ok > 0 ? t.grossEarnings / data.headcount.ok : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Cost"
        description={`${MONTH_NAMES[month - 1]} ${year}`}
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
                id: 'gross',
                label: 'Gross Earnings',
                value: inrShort(t.grossEarnings),
                icon: Wallet,
                subtext: `Run #${data.run.id} · ${data.run.status}`,
              },
              {
                id: 'net',
                label: 'Net Payable',
                value: inrShort(t.netSalary),
                icon: Banknote,
                subtext: `${inrShort(totalDeductions)} deducted`,
              },
              {
                id: 'ot',
                label: 'Overtime',
                value: inrShort(t.otAmount),
                icon: Clock,
                subtext: 'Included in gross',
              },
              {
                id: 'headcount',
                label: 'Employees Paid',
                value: data.headcount.ok,
                icon: Users,
                subtext: perHead > 0 ? `${inrShort(perHead)} average gross` : 'No paid lines',
                badge: data.headcount.hold > 0
                  ? { label: `${data.headcount.hold} on hold`, type: 'warning' }
                  : undefined,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ReportChartCard
              title="Gross Cost by Department"
              subtitle={`${data.byDepartment.length} department${data.byDepartment.length === 1 ? '' : 's'} · OK lines only`}
              className="mb-0"
              height={300}
            >
              <ReportBarChart
                data={data.byDepartment}
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
              title="Where the Gross Goes"
              subtitle="Net vs everything withheld"
              className="mb-0"
              height={300}
            >
              <ReportDonutChart
                data={[
                  { name: 'Net paid', value: Math.round(t.netSalary), color: '#10b981' },
                  { name: 'PF (employee)', value: Math.round(t.pfEmployee), color: '#6d4aff' },
                  { name: 'ESI (employee)', value: Math.round(t.esiEmployee), color: '#38bdf8' },
                  { name: 'Prof. tax', value: Math.round(t.professionalTax), color: '#f59e0b' },
                  { name: 'TDS', value: Math.round(t.tds), color: '#f43f5e' },
                  { name: 'Other', value: Math.round(t.otherDeductions + t.lomAmount + t.lwfAmount + t.healthInsurance + t.licAmount), color: '#94a3b8' },
                ]}
                centerLabel={inrShort(t.grossEarnings)}
                centerSubtext="gross"
                showBadges={false}
              />
            </ReportChartCard>
          </div>

          <ReportChartCard
            title="Headcount by Department"
            subtitle="Employees in this payroll run"
            className="mb-0"
          >
            <ReportBarChart
              data={data.byDepartment}
              xKey="department"
              yKey="count"
              seriesName="Employees"
            />
          </ReportChartCard>
        </>
      )}
    </div>
  );
}
