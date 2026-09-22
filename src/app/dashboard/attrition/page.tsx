/**
 * Dashboard — Attrition
 *
 * Reads the attrition slice of GET /api/dashboard/overview rather than
 * counting employees client-side, so the rate here and the rate on the home
 * dashboard are the same number computed once on the server.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarX, TrendingDown, UserMinus, Users } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import { ReportBarChart, ReportChartCard, ReportLineChart } from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';

interface AttritionPayload {
  headcount: { total: number };
  attrition: {
    months: Array<{ label: string; exits: number }>;
    totalExits12m: number;
    rate: number;
  };
}

const DANGER = '#f43f5e';

export default function AttritionDashboardPage() {
  const [data, setData] = useState<AttritionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load attrition');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The fetch flips `loading` on entry, which is the point: that state is
    // what drives the spinner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attrition" description="Exits over the last 12 months" />
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">{error ?? 'No data returned.'}</p>
        </div>
      </div>
    );
  }

  const { attrition, headcount } = data;
  const hasExits = attrition.months.some((m) => m.exits > 0);
  const worst = [...attrition.months].sort((a, b) => b.exits - a.exits)[0];
  const monthsWithExits = attrition.months.filter((m) => m.exits > 0).length;
  const avgPerMonth = monthsWithExits > 0 ? attrition.totalExits12m / 12 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attrition"
        description="Exit records over the last 12 months"
        eyebrow="Dashboard"
      />

      <ModuleKpiRow
        className="mb-0"
        items={[
          {
            id: 'rate',
            label: 'Attrition Rate (12 mo)',
            value: hasExits ? `${attrition.rate}%` : '—',
            icon: TrendingDown,
            subtext: 'Exits vs headcount today',
          },
          {
            id: 'exits',
            label: 'Total Exits',
            value: attrition.totalExits12m,
            icon: UserMinus,
            subtext: 'Last 12 months',
          },
          {
            id: 'avg',
            label: 'Average per Month',
            value: hasExits ? avgPerMonth.toFixed(1) : '—',
            icon: CalendarX,
            subtext: hasExits ? `Across ${monthsWithExits} active month(s)` : 'No exits recorded',
          },
          {
            id: 'headcount',
            label: 'Current Headcount',
            value: headcount.total,
            icon: Users,
            subtext: 'Denominator for the rate',
          },
        ]}
      />

      {!hasExits ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-main)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No exit records in the last 12 months
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Charts appear once exit interviews are recorded.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ReportChartCard
            title="Exit Trend"
            subtitle="Exits per month · last 12 months"
            className="mb-0"
          >
            <ReportLineChart
              data={attrition.months}
              xKey="label"
              yKey="exits"
              color={DANGER}
              seriesName="Exits"
            />
          </ReportChartCard>

          <ReportChartCard
            title="Exits by Month"
            subtitle={worst ? `Peak: ${worst.label} (${worst.exits})` : undefined}
            className="mb-0"
          >
            <ReportBarChart
              data={attrition.months}
              xKey="label"
              yKey="exits"
              color={DANGER}
              seriesName="Exits"
            />
          </ReportChartCard>
        </div>
      )}
    </div>
  );
}
