'use client';

import { useState, useEffect } from 'react';
import { DataTable, KPICard, KPIGrid, MiniBarChart, DonutChart, SectionCard, Tabs } from '@/components/ui';
import type { Column } from '@/components/ui';

interface Kpis {
  tnaPending: number;
  nominationsPending: number;
  schedulesUpcoming: number;
  schedulesCompletedThisMonth: number;
  plansApproved: number;
  plansDraft: number;
  competencyGaps: number;
  feedbackPending: number;
  programs: number;
  trainers: number;
  venues: number;
  trainingHoursThisMonth: number;
  estimatedCostYtd: number;
  budgetUtilizationPct: number;
  mandatoryPending: number;
  avgAssessmentScore: number;
  avgEffectivenessImprovement: number;
  certificatesIssued: number;
  completionPct: number;
  coveragePct: number;
  attendancePct: number;
  assessmentPassPct: number;
  competencyGapPct: number;
  skillGapPct: number;
  gapClosurePct: number;
  hoursPerEmployee: number;
}

interface Charts {
  monthly: { month: string; scheduled: number; completed: number; hours: number; cost: number }[];
  nominationsByStatus: { name: string; value: number }[];
  effectivenessByRating: { name: string; value: number }[];
  attendanceByStatus: { name: string; value: number }[];
  assessmentResults: { name: string; value: number }[];
  byDepartment: { name: string; value: number }[];
  byCategory: { name: string; value: number }[];
  mandatoryVsOptional: { name: string; value: number }[];
  costByMonth: { month: string; cost: number }[];
  preVsPost: { name: string; value: number }[];
  skillDistribution: { name: string; value: number }[];
  effectivenessTrend: { name: string; value: number }[];
}

interface ScheduleRow {
  id: number;
  title: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  method: string | null;
  status: string;
  trainingProgram: { name: string } | null;
  nominations: { id: number }[];
}

type DashTab = 'overview' | 'metrics' | 'analytics';

/** Compact stat tile — keeps every KPI visible without the heavy card look. */
function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{value}</div>
      {hint && <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{hint}</div>}
    </div>
  );
}

/** Small attention chip — a quieter alternative to a full KPI card. */
function AttentionChip({ label, value, tone }: { label: string; value: number; tone: 'warn' | 'info' | 'ok' }) {
  const colors = {
    warn: { bg: '#fef9c3', fg: '#854d0e' },
    info: { bg: '#dbeafe', fg: '#1e40af' },
    ok: { bg: '#dcfce7', fg: '#166534' },
  }[tone];
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: colors.bg, color: colors.fg }}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function TrainingDashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DashTab>('overview');

  useEffect(() => {
    let mounted = true;
    fetch('/api/training-dashboard')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
        return res.json();
      })
      .then((json) => {
        if (!mounted) return;
        setKpis(json.data.kpis);
        setCharts(json.data.charts);
        setUpcoming(json.data.upcomingList);
      })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : 'Unknown error'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const columns: Column<ScheduleRow>[] = [
    { key: 'program', label: 'Program', render: (r) => r.trainingProgram?.name ?? r.title ?? '—' },
    { key: 'scheduledDate', label: 'Date', render: (r) => (r.scheduledDate ? r.scheduledDate.slice(0, 10) : '—') },
    { key: 'startTime', label: 'Time', render: (r) => r.startTime ?? '—' },
    { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
    { key: 'nominations', label: 'Nominees', render: (r) => r.nominations.length },
    { key: 'status', label: 'Status' },
  ];

  const attentionTotal =
    (kpis?.tnaPending ?? 0) + (kpis?.nominationsPending ?? 0) +
    (kpis?.feedbackPending ?? 0) + (kpis?.mandatoryPending ?? 0);

  return (
    <div className="space-y-5">
      {/* Friendly header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Learning Dashboard</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Training health at a glance — switch tabs for full metrics and analytics.
        </p>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Hero row — the four numbers that matter most */}
      <KPIGrid columns={4}>
        <KPICard label="Completion Rate" value={`${kpis?.completionPct ?? 0}%`} tone="success" />
        <KPICard label="Upcoming Sessions" value={kpis?.schedulesUpcoming ?? 0} tone="info" />
        <KPICard label="Needs Attention" value={attentionTotal} tone={attentionTotal > 0 ? 'warning' : 'success'} />
        <KPICard label="Hours per Employee" value={kpis?.hoursPerEmployee ?? 0} tone="info" />
      </KPIGrid>

      {/* Quiet attention strip — actionable items as small chips, not big cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <AttentionChip label="Pending TNA requests" value={kpis?.tnaPending ?? 0} tone="warn" />
        <AttentionChip label="Nominations awaiting approval" value={kpis?.nominationsPending ?? 0} tone="warn" />
        <AttentionChip label="Feedback forms pending" value={kpis?.feedbackPending ?? 0} tone="warn" />
        <AttentionChip label="Mandatory training pending" value={kpis?.mandatoryPending ?? 0} tone="warn" />
      </div>

      <Tabs<DashTab>
        variant="segmented"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'metrics', label: 'All Metrics' },
          { key: 'analytics', label: 'Analytics' },
        ]}
      />

      {/* ── Overview: the essentials — trend chart, department split, next sessions ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {charts && (
            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Sessions per Month">
                <MiniBarChart
                  data={charts.monthly.map((m) => ({ label: m.month, values: [m.scheduled, m.completed] }))}
                  series={[{ name: 'Scheduled', color: '#6366f1' }, { name: 'Completed', color: '#22c55e' }]}
                />
              </SectionCard>
              <SectionCard title="Department-wise Training">
                <DonutChart data={charts.byDepartment} />
              </SectionCard>
            </div>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Upcoming Training Sessions</h2>
            <DataTable columns={columns} data={upcoming} loading={loading} emptyMessage="No upcoming training sessions." />
          </section>
        </div>
      )}

      {/* ── All Metrics: every KPI preserved, grouped as quiet stat tiles ── */}
      {tab === 'metrics' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SectionCard title="Pipeline">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Pending TNA" value={kpis?.tnaPending ?? 0} />
              <StatTile label="Pending Nominations" value={kpis?.nominationsPending ?? 0} />
              <StatTile label="Upcoming Schedules" value={kpis?.schedulesUpcoming ?? 0} />
              <StatTile label="Completed This Month" value={kpis?.schedulesCompletedThisMonth ?? 0} />
              <StatTile label="Approved Plans" value={kpis?.plansApproved ?? 0} />
              <StatTile label="Draft Plans" value={kpis?.plansDraft ?? 0} />
            </div>
          </SectionCard>
          <SectionCard title="Delivery">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Programs" value={kpis?.programs ?? 0} />
              <StatTile label="Trainers" value={kpis?.trainers ?? 0} />
              <StatTile label="Venues" value={kpis?.venues ?? 0} />
              <StatTile label="Certificates Issued" value={kpis?.certificatesIssued ?? 0} />
              <StatTile label="Training Hours (Month)" value={kpis?.trainingHoursThisMonth ?? 0} />
              <StatTile label="Hours / Employee" value={kpis?.hoursPerEmployee ?? 0} />
            </div>
          </SectionCard>
          <SectionCard title="Outcomes (§42)">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Completion" value={`${kpis?.completionPct ?? 0}%`} />
              <StatTile label="Coverage" value={`${kpis?.coveragePct ?? 0}%`} />
              <StatTile label="Attendance" value={`${kpis?.attendancePct ?? 0}%`} />
              <StatTile label="Assessment Pass" value={`${kpis?.assessmentPassPct ?? 0}%`} />
              <StatTile label="Avg Assessment Score" value={`${kpis?.avgAssessmentScore ?? 0}%`} />
              <StatTile label="Avg Improvement" value={kpis?.avgEffectivenessImprovement ?? 0} />
            </div>
          </SectionCard>
          <SectionCard title="Gaps & Compliance">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Competency Records" value={kpis?.competencyGaps ?? 0} />
              <StatTile label="Competency Gap" value={`${kpis?.competencyGapPct ?? 0}%`} />
              <StatTile label="Skill Gap" value={`${kpis?.skillGapPct ?? 0}%`} />
              <StatTile label="Gap Closure" value={`${kpis?.gapClosurePct ?? 0}%`} />
              <StatTile label="Mandatory Pending" value={kpis?.mandatoryPending ?? 0} />
              <StatTile label="Feedback Pending" value={kpis?.feedbackPending ?? 0} />
            </div>
          </SectionCard>
          <SectionCard title="Budget">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Est. Cost YTD" value={kpis?.estimatedCostYtd ?? 0} hint="All recorded cost heads" />
              <StatTile label="Budget Utilization" value={`${kpis?.budgetUtilizationPct ?? 0}%`} hint={kpis && kpis.budgetUtilizationPct > 90 ? 'Over 90% used' : 'Within budget'} />
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Analytics: the full chart library, unchanged ── */}
      {tab === 'analytics' && charts && (
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Sessions per Month">
            <MiniBarChart
              data={charts.monthly.map((m) => ({ label: m.month, values: [m.scheduled, m.completed] }))}
              series={[{ name: 'Scheduled', color: '#6366f1' }, { name: 'Completed', color: '#22c55e' }]}
            />
          </SectionCard>
          <SectionCard title="Training Hours per Month">
            <MiniBarChart
              data={charts.monthly.map((m) => ({ label: m.month, values: [m.hours] }))}
              series={[{ name: 'Hours', color: '#0ea5e9' }]}
            />
          </SectionCard>
          <SectionCard title="Training Cost per Month (₹)">
            <MiniBarChart
              data={charts.costByMonth.map((m) => ({ label: m.month, values: [m.cost] }))}
              series={[{ name: 'Cost', color: '#f59e0b' }]}
            />
          </SectionCard>
          <SectionCard title="Department-wise Training">
            <DonutChart data={charts.byDepartment} />
          </SectionCard>
          <SectionCard title="Category-wise Training">
            <DonutChart data={charts.byCategory} />
          </SectionCard>
          <SectionCard title="Mandatory vs Optional Nominations">
            <DonutChart data={charts.mandatoryVsOptional} />
          </SectionCard>
          <SectionCard title="Pre vs Post Score (avg %)">
            <MiniBarChart
              data={charts.preVsPost.map((p) => ({ label: p.name, values: [p.value] }))}
              series={[{ name: 'Avg Score', color: '#8b5cf6' }]}
            />
          </SectionCard>
          <SectionCard title="Skill Proficiency Distribution">
            <DonutChart data={charts.skillDistribution} />
          </SectionCard>
          <SectionCard title="Effectiveness Trend (avg improvement by stage)">
            <MiniBarChart
              data={charts.effectivenessTrend.map((e) => ({ label: e.name, values: [e.value] }))}
              series={[{ name: 'Improvement', color: '#10b981' }]}
            />
          </SectionCard>
          <SectionCard title="Nominations by Status">
            <DonutChart data={charts.nominationsByStatus} />
          </SectionCard>
          <SectionCard title="Attendance Breakdown">
            <DonutChart data={charts.attendanceByStatus} />
          </SectionCard>
          <SectionCard title="Assessment Results">
            <DonutChart data={charts.assessmentResults} />
          </SectionCard>
          <SectionCard title="Effectiveness Ratings">
            <DonutChart data={charts.effectivenessByRating} />
          </SectionCard>
        </div>
      )}
      {tab === 'analytics' && !charts && loading && (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading analytics…</p>
      )}
    </div>
  );
}
