/**
 * Org-wide HR dashboard rendered on `/`.
 *
 * Everything on this page comes from one call to /api/dashboard/overview —
 * the panels below slice that single payload rather than each fetching their
 * own endpoint. Any slice that came back empty renders PanelEmpty instead of
 * a chart, so a sparse database reads as "no data yet" and never as an
 * invented figure.
 *
 * Chart colours are the app's CSS theme tokens passed straight into SVG fills
 * (the pattern /ess/dashboard already uses), which is what keeps the charts
 * correct in dark mode without a second palette.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Panel, PanelEmpty, Row } from './Panel';
import type { OverviewData } from './types';

// ── formatting ───────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('en-IN');

/** ₹ in Indian short scale — what an Indian payroll reader expects to see. */
function inrShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${nf.format(Math.round(n))}`;
}

function inr(n: number) {
  return `₹${nf.format(Math.round(n))}`;
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--foreground)',
};

const axisTick = { fontSize: 10.5, fill: 'var(--foreground-muted)' };

// ── KPI tile ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[30px] font-bold leading-none tracking-tight tabular-nums"
        style={{ color: 'var(--foreground)' }}
      >
        {value}
      </div>
      <div className="mt-2.5 text-[12px]" style={{ color: 'var(--foreground-muted)' }}>
        {sub}
      </div>
    </div>
  );
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card h-[118px] animate-pulse" />
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
          leaveByStatus, salaryCost, statutory, settledRun, payrollRun, attrition } = data;

  // The newest run is often an empty draft for the month ahead, so the money
  // KPI reports the last run that was actually calculated.
  const latestCost = [...salaryCost].reverse().find((c) => c.gross > 0) ?? null;
  const asOf = new Date(data.asOf).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const donut = [
    { name: 'Present', value: attendanceToday.present, color: 'var(--success)' },
    { name: 'On leave', value: attendanceToday.onLeave, color: 'var(--info)' },
    { name: 'Absent', value: attendanceToday.absent, color: 'var(--danger)' },
  ].filter((d) => d.value > 0);

  const statutoryTotal = statutory
    ? statutory.pfEmployee + statutory.pfEmployer + statutory.esiEmployee +
      statutory.esiEmployer + statutory.professionalTax + statutory.tds
    : 0;

  const hasAttrition = attrition.months.some((m) => m.exits > 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      {/* KPI row */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Total Headcount"
          value={nf.format(headcount.total)}
          sub={`${headcount.byDepartment.length} department${headcount.byDepartment.length === 1 ? '' : 's'}`}
        />
        <Kpi
          label="Present Today"
          value={attendanceToday.marked > 0 ? nf.format(attendanceToday.present) : '—'}
          sub={
            attendanceToday.marked > 0
              ? `${attendanceToday.rate}% of ${nf.format(attendanceToday.marked)} marked · ${attendanceToday.onLeave} leave · ${attendanceToday.absent} absent`
              : 'Attendance not marked for today yet'
          }
        />
        <Kpi
          label="Pending Approvals"
          value={nf.format(pendingApprovals.total)}
          sub={`${pendingApprovals.leave} leave · ${pendingApprovals.overtime} OT · ${pendingApprovals.compOff} comp-off`}
        />
        <Kpi
          label="Monthly Salary Cost"
          value={latestCost ? inrShort(latestCost.gross) : '—'}
          sub={
            latestCost
              ? `${latestCost.label} gross · incl. ${inrShort(latestCost.ot)} OT`
              : 'No payroll run calculated yet'
          }
        />
        <Kpi
          label="Attrition (12 mo)"
          value={hasAttrition ? `${attrition.rate}%` : '—'}
          sub={
            hasAttrition
              ? `${attrition.totalExits12m} exit${attrition.totalExits12m === 1 ? '' : 's'} vs headcount today`
              : 'No exit records in the last 12 months'
          }
        />
      </div>

      {/* Headcount + attendance trend */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Panel title="Headcount by Department" caption={`Active employees · ${nf.format(headcount.total)} total`}>
          {headcount.byDepartment.length === 0 ? (
            <PanelEmpty message="No active employees with a department assigned." />
          ) : (
            <div style={{ height: Math.max(220, headcount.byDepartment.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={headcount.byDepartment}
                  layout="vertical"
                  margin={{ top: 4, right: 36, left: 8, bottom: 4 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category" dataKey="department" width={132}
                    tick={axisTick} axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-hover)' }}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [nf.format(Number(v)), 'Employees'] as [string, string]}
                  />
                  <Bar dataKey="count" fill="var(--info)" radius={[0, 4, 4, 0]} minPointSize={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Attendance %" caption="Weekly average · last 12 weeks">
          {attendanceTrend.length === 0 ? (
            <PanelEmpty message="No attendance marked in the last 12 weeks." />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={axisTick} axisLine={false} tickLine={false}
                    domain={[0, 100]} tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${Number(v)}%`, 'Present'] as [string, string]}
                  />
                  <Area
                    type="monotone" dataKey="rate" stroke="var(--success)" strokeWidth={2}
                    fill="var(--success)" fillOpacity={0.12}
                    dot={{ r: 3, fill: 'var(--success)', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaveByStatus} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={tooltipStyle} />
                    <Bar dataKey="approved" stackId="a" name="Approved" fill="var(--success)" />
                    <Bar dataKey="pending" stackId="a" name="Pending" fill="var(--warning)" />
                    <Bar dataKey="rejected" stackId="a" name="Rejected" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-[11.5px]" style={{ color: 'var(--foreground-muted)' }}>
                {[
                  { label: 'Approved', color: 'var(--success)' },
                  { label: 'Pending', color: 'var(--warning)' },
                  { label: 'Rejected', color: 'var(--danger)' },
                ].map((l) => (
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salaryCost} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={axisTick} axisLine={false} tickLine={false} width={62}
                    tickFormatter={(v: number) => inrShort(v)}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-hover)' }}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [inr(Number(v)), 'Gross'] as [string, string]}
                  />
                  <Bar dataKey="gross" fill="var(--info)" radius={[4, 4, 0, 0]} minPointSize={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Attrition" caption="Exits per month · last 12 months">
          {!hasAttrition ? (
            <PanelEmpty message="No exit records in the last 12 months." />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attrition.months} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [nf.format(Number(v)), 'Exits'] as [string, string]} />
                  <Line
                    type="monotone" dataKey="exits" stroke="var(--danger)" strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--danger)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
              <div className="relative h-[176px] w-[176px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut} dataKey="value" nameKey="name"
                      innerRadius={58} outerRadius={84} paddingAngle={2} strokeWidth={0}
                    >
                      {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-[24px] font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {attendanceToday.rate}%
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
                      Present
                    </div>
                  </div>
                </div>
              </div>
              <div className="min-w-[150px] flex-1">
                <Row label={<Legend color="var(--success)">Present</Legend>} value={nf.format(attendanceToday.present)} />
                <Row label={<Legend color="var(--info)">On leave</Legend>} value={nf.format(attendanceToday.onLeave)} />
                <Row label={<Legend color="var(--danger)">Absent</Legend>} value={nf.format(attendanceToday.absent)} />
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
