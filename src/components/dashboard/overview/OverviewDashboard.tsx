/**
 * Org-wide HR dashboard rendered on `/`.
 *
 * Everything on this page comes from one call to /api/dashboard/overview —
 * the panels below slice that single payload rather than each fetching their
 * own endpoint. Any slice that came back empty renders PanelEmpty instead of
 * a chart, so a sparse database reads as "no data yet" and never as an
 * invented figure.
 *
 * Every chart is one of the shared components in @/components/ui/ReportCharts,
 * ported from the Suki Tools module — so tooltips, grids, bar caps and the
 * entrance animation match across both apps and the series colour follows the
 * live theme accent. Status colours (present/leave/absent, approved/pending/
 * rejected) stay as CSS theme tokens, since those carry meaning and must not
 * change when the accent does.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList,
  TrendingDown,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  ReportAreaChart,
  ReportBarChart,
  ReportDonutChart,
  ReportLineChart,
  ReportStackedBarChart,
} from '@/components/ui/ReportCharts';
import KPICard from '@/components/ui/KPICard';
import { Panel, PanelEmpty, Row } from './Panel';
import { AttendanceOverviewChart } from './AttendanceOverviewChart';
import type { OverviewData } from './types';

// ── formatting ───────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('en-IN');

/**
 * Status colours. Recharts writes these straight into SVG fills and cannot
 * resolve `var(--success)`, so they are literals rather than theme tokens.
 * They must not follow the accent: green/amber/red mean approved/pending/
 * rejected regardless of which theme is on.
 */
const SUCCESS = '#10b981';
const WARNING = '#f59e0b';
const DANGER = '#f43f5e';
const INFO = '#38bdf8';

const LEAVE_SERIES = [
  { key: 'approved', name: 'Approved', label: 'Approved', color: SUCCESS },
  { key: 'pending', name: 'Pending', label: 'Pending', color: WARNING },
  { key: 'rejected', name: 'Rejected', label: 'Rejected', color: DANGER },
];

/** ₹ in Indian short scale — what an Indian payroll reader expects to see. */
function inrShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${nf.format(Math.round(n))}`;
}

function inr(n: number) {
  return `₹${nf.format(Math.round(n))}`;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function OverviewDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry — the effect below is the only place that fetches, so a
  // retry is a re-run of it rather than a second code path.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/overview');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // The permission gate returns `required` and `roleId` alongside the
          // message — surfacing them turns "Forbidden" into something an admin
          // can actually act on (which permission, which role).
          const detail = [
            body.required ? `needs ${body.required}` : null,
            body.roleId !== undefined ? `role #${body.roleId}` : null,
          ].filter(Boolean).join(' · ');
          throw new Error(
            `${body.error ?? `Request failed (${res.status})`}${detail ? ` (${detail})` : ''}`
          );
        }
        const json = await res.json();
        if (!cancelled) { setData(json); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card h-[132px] animate-pulse" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="card h-[340px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="card p-6">
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>
            Dashboard unavailable
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--foreground-muted)' }}>
            {error ?? 'No data returned.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-full border px-4 py-2 text-[12px] font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { headcount, attendanceToday, pendingApprovals, attendanceTrend,
          leaveByStatus, salaryCost, statutory,
          settledRun, payrollRun, attrition } = data;

  // The newest run is often an empty draft for the month ahead, so the money
  // KPI reports the last run that was actually calculated.
  const latestCost = [...salaryCost].reverse().find((c) => c.gross > 0) ?? null;
  const asOf = new Date(data.asOf).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const donut = [
    { name: 'Present', value: attendanceToday.present, color: SUCCESS },
    { name: 'On leave', value: attendanceToday.onLeave, color: INFO },
    { name: 'Absent', value: attendanceToday.absent, color: DANGER },
  ].filter((d) => d.value > 0);

  const statutoryTotal = statutory
    ? statutory.pfEmployee + statutory.pfEmployer + statutory.esiEmployee +
      statutory.esiEmployer + statutory.professionalTax + statutory.tds
    : 0;

  const hasAttrition = attrition.months.some((m) => m.exits > 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard
          label="Total Headcount"
          value={headcount.total}
          tone="warning"
          icon={<Users />}
          subtitle={`${headcount.byDepartment.length} department${headcount.byDepartment.length === 1 ? '' : 's'}`}
        />
        <KPICard
          label="Present Today"
          value={attendanceToday.marked > 0 ? attendanceToday.present : '—'}
          tone="info"
          icon={<UserCheck />}
          trend={
            attendanceToday.marked > 0 && attendanceToday.rate != null
              ? { direction: 'up', value: `${attendanceToday.rate}%`, label: 'present of marked' }
              : undefined
          }
          subtitle={attendanceToday.marked > 0 ? undefined : 'Attendance not marked for today yet'}
        />
        <KPICard
          label="Pending Approvals"
          value={pendingApprovals.total}
          tone="success"
          icon={<ClipboardList />}
          subtitle={`${pendingApprovals.leave} leave · ${pendingApprovals.overtime} OT · ${pendingApprovals.compOff} comp-off`}
        />
        <KPICard
          label="Monthly Salary Cost"
          value={latestCost ? inrShort(latestCost.gross) : '—'}
          tone="accent"
          icon={<Wallet />}
          subtitle={
            latestCost
              ? `${latestCost.label} gross · incl. ${inrShort(latestCost.ot)} OT`
              : 'No payroll run calculated yet'
          }
        />
        <KPICard
          label="Attrition (12 mo)"
          value={hasAttrition ? `${attrition.rate}%` : '—'}
          tone="danger"
          icon={<TrendingDown />}
          trend={
            hasAttrition
              ? {
                  direction: 'down',
                  value: `${attrition.totalExits12m}`,
                  label: `exit${attrition.totalExits12m === 1 ? '' : 's'} vs headcount today`,
                }
              : undefined
          }
          subtitle={hasAttrition ? undefined : 'No exit records in the last 12 months'}
        />
      </div>

      {/* Lead chart: present above the line, absent below */}
      <AttendanceOverviewChart overview={data.attendanceOverview} />

      {/* Headcount + attendance trend */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Panel title="Headcount by Department" caption={`Active employees · ${nf.format(headcount.total)} total`}>
          {headcount.byDepartment.length === 0 ? (
            <PanelEmpty message="No active employees with a department assigned." />
          ) : (
            <div style={{ height: Math.max(220, headcount.byDepartment.length * 34) }}>
              <ReportBarChart
                data={headcount.byDepartment}
                xKey="department"
                yKey="count"
                horizontal
                categoryWidth={132}
                seriesName="Employees"
              />
            </div>
          )}
        </Panel>

        <Panel title="Attendance %" caption="Weekly average · last 12 weeks">
          {attendanceTrend.length === 0 ? (
            <PanelEmpty message="No attendance marked in the last 12 weeks." />
          ) : (
            <div className="h-[300px]">
              <ReportAreaChart
                data={attendanceTrend}
                xKey="label"
                yKey="rate"
                color={SUCCESS}
                seriesName="Present"
                domain={[0, 100]}
                axisFormatter={(v) => `${v}%`}
                valueFormatter={(v) => `${v}%`}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* Leave / cost / attrition */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Leave Applications by Status" caption="Last 6 months">
          {leaveByStatus.length === 0 ? (
            <PanelEmpty message="No leave applied for in the last 6 months." />
          ) : (
            <>
              <div className="h-[240px]">
                <ReportStackedBarChart
                  data={leaveByStatus}
                  xKey="label"
                  series={LEAVE_SERIES}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-[11.5px]" style={{ color: 'var(--foreground-muted)' }}>
                {LEAVE_SERIES.map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <i className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Salary Cost Trend" caption="Total gross · last 6 payroll runs">
          {salaryCost.length === 0 ? (
            <PanelEmpty message="No payroll run has been calculated yet." />
          ) : (
            <div className="h-[280px]">
              <ReportBarChart
                data={salaryCost}
                xKey="label"
                yKey="gross"
                seriesName="Gross"
                yAxisWidth={62}
                axisFormatter={inrShort}
                valueFormatter={inr}
              />
            </div>
          )}
        </Panel>

        <Panel title="Attrition" caption="Exits per month · last 12 months">
          {!hasAttrition ? (
            <PanelEmpty message="No exit records in the last 12 months." />
          ) : (
            <div className="h-[280px]">
              <ReportLineChart
                data={attrition.months}
                xKey="label"
                yKey="exits"
                color={DANGER}
                seriesName="Exits"
                valueFormatter={(v) => nf.format(v)}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* Today / statutory / payroll pipeline */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel title="Today's Attendance" caption={`${nf.format(headcount.total)} employees`}>
          {donut.length === 0 ? (
            <PanelEmpty message="Attendance has not been marked for today." />
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <div className="h-[196px] w-[196px] shrink-0">
                <ReportDonutChart
                  data={donut}
                  centerLabel={`${attendanceToday.rate}%`}
                  centerSubtext="Present"
                  showBadges={false}
                  showLegend={false}
                />
              </div>
              <div className="min-w-[150px] flex-1">
                <Row label={<Legend color={SUCCESS}>Present</Legend>} value={nf.format(attendanceToday.present)} />
                <Row label={<Legend color={INFO}>On leave</Legend>} value={nf.format(attendanceToday.onLeave)} />
                <Row label={<Legend color={DANGER}>Absent</Legend>} value={nf.format(attendanceToday.absent)} />
                <Row label="Not marked yet" value={nf.format(attendanceToday.unmarked)} />
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Statutory Summary"
          caption={settledRun ? `${settledRun.label} · payable to authorities` : 'No payroll run'}
        >
          {!statutory || statutoryTotal === 0 ? (
            <PanelEmpty message="No statutory amounts calculated yet." />
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="pb-2 text-left text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Head</th>
                  <th className="pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Employee</th>
                  <th className="pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Employer</th>
                  <th className="pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { head: 'Provident Fund (PF)', ee: statutory.pfEmployee, er: statutory.pfEmployer },
                  { head: 'ESI', ee: statutory.esiEmployee, er: statutory.esiEmployer },
                  { head: 'Professional Tax', ee: statutory.professionalTax, er: null },
                  { head: 'TDS (Income Tax)', ee: statutory.tds, er: null },
                ].map((r) => (
                  <tr key={r.head} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5" style={{ color: 'var(--foreground-muted)' }}>{r.head}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{inr(r.ee)}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{r.er === null ? '—' : inr(r.er)}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{inr(r.ee + (r.er ?? 0))}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2.5 font-bold" style={{ color: 'var(--foreground)' }}>Total Statutory</td>
                  <td colSpan={3} className="pt-2.5 text-right font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                    {inr(statutoryTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Payroll Processing Status"
          caption={payrollRun ? `Run #${payrollRun.id} · ${payrollRun.label}` : undefined}
        >
          {!payrollRun ? (
            <PanelEmpty message="No payroll run created yet." />
          ) : (
            <>
              <Stages current={payrollRun.status} />
              <div className="mt-4">
                <Row label="Employees in run" value={nf.format(payrollRun.totalLines)} />
                <Row label="Salary cleared" value={nf.format(payrollRun.clearedLines)} />
                <Row
                  label="Employees on hold"
                  value={
                    <span style={{ color: payrollRun.holdLines > 0 ? 'var(--warning)' : undefined }}>
                      {nf.format(payrollRun.holdLines)}
                    </span>
                  }
                />
                <Row label="Gross at risk (hold)" value={inr(payrollRun.grossAtRisk)} />
              </div>
            </>
          )}
        </Panel>
      </div>

      <p className="pb-2 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
        Live data from your HRMS database · as on {asOf}
      </p>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <i className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {children}
    </span>
  );
}

/**
 * PayrollRun.status chain. VALIDATED/SUBMITTED are optional stages (they only
 * run when PayrollWorkflowConfig enables them), so they're shown but a run
 * that skips them still lights up everything before its current stage.
 */
const STAGES = ['DRAFT', 'CALCULATED', 'VALIDATED', 'SUBMITTED', 'APPROVED', 'LOCKED', 'POSTED'];

function Stages({ current }: { current: string }) {
  const idx = STAGES.indexOf(current);
  return (
    <div className="flex gap-0.5 overflow-hidden rounded-lg">
      {STAGES.map((s, i) => {
        const done = idx >= 0 && i <= idx;
        return (
          <div
            key={s}
            className="flex-1 px-1 py-2 text-center text-[9.5px] font-semibold uppercase tracking-wide"
            style={{
              background: done ? 'var(--info)' : 'var(--chart-track)',
              color: done ? '#ffffff' : 'var(--foreground-muted)',
            }}
            title={s}
          >
            {s.slice(0, 4)}
          </div>
        );
      })}
    </div>
  );
}
