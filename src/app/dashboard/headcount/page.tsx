/**
 * Dashboard — Headcount (Department-wise)
 *
 * Every figure here comes from GET /api/reports/headcount, which is the same
 * aggregation the Headcount report exports. The dashboard is the visual read of
 * that report, so the two can never disagree about what the headcount is.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, IdCard, Users, VenetianMask } from 'lucide-react';
import { PageHeader, Spinner } from '@/components/ui';
import {
  ReportBarChart,
  ReportChartCard,
  ReportDonutChart,
} from '@/components/ui/ReportCharts';
import { ModuleKpiRow } from '@/components/ui/ModuleKpiRow';

interface HeadcountReport {
  asOfDate: string;
  totalHeadcount: number;
  byDepartment: Array<{ department: string; count: number }>;
  byEmployeeType: Array<{ employeeType: string; count: number }>;
  byDesignation: Array<{ designation: string; count: number }>;
  byGender: Array<{ gender: string; count: number }>;
}

/** Gender is a fixed set, so it gets fixed colours rather than the accent. */
const GENDER_COLORS: Record<string, string> = {
  Male: '#38bdf8',
  Female: '#f472b6',
  Other: '#a78bfa',
  Unknown: '#94a3b8',
};

export default function HeadcountDashboardPage() {
  const [data, setData] = useState<HeadcountReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/headcount');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load headcount');
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
        <PageHeader title="Headcount" description="Department-wise headcount" />
        <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-muted)]">{error ?? 'No data returned.'}</p>
        </div>
      </div>
    );
  }

  const { byDepartment, byEmployeeType, byDesignation, byGender } = data;
  // Long tail of designations is noise on a dashboard; the report has them all.
  const topDesignations = [...byDesignation].sort((a, b) => b.count - a.count).slice(0, 8);
  const largestDept = [...byDepartment].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Headcount"
        description={`Active employees as on ${data.asOfDate}`}
        eyebrow="Dashboard"
      />

      <ModuleKpiRow
        className="mb-0"
        items={[
          {
            id: 'total',
            label: 'Total Headcount',
            value: data.totalHeadcount,
            icon: Users,
            subtext: `${byDepartment.length} department${byDepartment.length === 1 ? '' : 's'}`,
          },
          {
            id: 'largest',
            label: 'Largest Department',
            value: largestDept?.count ?? 0,
            icon: Building2,
            subtext: largestDept?.department ?? '—',
          },
          {
            id: 'types',
            label: 'Employee Types',
            value: byEmployeeType.length,
            icon: IdCard,
            subtext: byEmployeeType.map((t) => t.employeeType).slice(0, 3).join(' · ') || '—',
          },
          {
            id: 'designations',
            label: 'Designations',
            value: byDesignation.length,
            icon: VenetianMask,
            subtext: 'Distinct roles on the payroll',
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ReportChartCard
          title="Headcount by Department"
          subtitle={`${data.totalHeadcount} active employees`}
          className="mb-0"
          height={300}
        >
          <ReportBarChart
            data={byDepartment}
            xKey="department"
            yKey="count"
            horizontal
            categoryWidth={150}
            seriesName="Employees"
          />
        </ReportChartCard>

        <ReportChartCard
          title="Gender Split"
          subtitle="Across active employees"
          className="mb-0"
          height={300}
        >
          <ReportDonutChart
            data={byGender.map((g) => ({
              name: g.gender,
              value: g.count,
              color: GENDER_COLORS[g.gender] ?? GENDER_COLORS.Unknown,
            }))}
            centerSubtext="employees"
          />
        </ReportChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportChartCard title="By Employee Type" subtitle="Permanent, contract, trainee …" className="mb-0">
          <ReportBarChart
            data={byEmployeeType}
            xKey="employeeType"
            yKey="count"
            seriesName="Employees"
          />
        </ReportChartCard>

        <ReportChartCard
          title="By Designation"
          subtitle={
            byDesignation.length > topDesignations.length
              ? `Top ${topDesignations.length} of ${byDesignation.length}`
              : 'All designations'
          }
          className="mb-0"
        >
          <ReportBarChart
            data={topDesignations}
            xKey="designation"
            yKey="count"
            horizontal
            categoryWidth={150}
            seriesName="Employees"
          />
        </ReportChartCard>
      </div>
    </div>
  );
}
