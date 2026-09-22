'use client';

/**
 * Attendance Overview — the dashboard's lead chart.
 *
 * Mirrored bars in the Suki Tools "unit-wise movements" style: present above
 * the zero line, absent below it, so a bad week reads as a shape rather than a
 * number you have to compare.
 *
 * The API returns every period x department x unit cell in one payload, so
 * department, unit and week/month/year all resolve client-side — no request
 * per dropdown change.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BAR_ANIMATION, BAR_ANIMATION_STAGGER } from '@/components/ui/BarChartEffects';
import { useAccent } from '@/components/ui/ReportCharts';
import type {
  AttendanceGranularity,
  AttendanceOverview,
  AttendanceOverviewBucket,
} from './types';

const nf = new Intl.NumberFormat('en-IN');

/** Mix a hex toward white — the "received" tint in the tools original. */
function lightenHex(hex: string, amount = 0.5): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

interface ChartRow {
  label: string;
  sort: string;
  present: number;
  absent: number;
  counted: number;
  rate: number;
  /** Positive → drawn up, negative → drawn down (stackOffset="sign"). */
  presentUp: number;
  absentDown: number;
}

function OverviewTooltip({
  active,
  payload,
  presentColor,
  absentColor,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
  presentColor: string;
  absentColor: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-[178px] rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] px-3.5 py-3 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.22)]">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: presentColor }} />
          <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
            Present&nbsp; {nf.format(row.present)}
          </span>
          <span className="ml-auto text-[11px] font-semibold tabular-nums text-emerald-500">
            {row.rate}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: absentColor }} />
          <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
            Absent&nbsp; {nf.format(row.absent)}
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[var(--border-main)] pt-2">
        <span className="text-[11px] text-[var(--text-muted)]">{row.label}</span>
        <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
          {nf.format(row.counted)} marked
        </span>
      </div>
    </div>
  );
}

const ALL = 'All';

/** Sum the cells matching the current department / unit / granularity. */
function rollUp(
  buckets: AttendanceOverviewBucket[],
  g: AttendanceGranularity,
  department: string,
  unit: string
): ChartRow[] {
  const byPeriod = new Map<string, ChartRow>();

  for (const b of buckets) {
    if (b.g !== g) continue;
    if (department !== ALL && b.department !== department) continue;
    if (unit !== ALL && b.unit !== unit) continue;

    let row = byPeriod.get(b.sort);
    if (!row) {
      row = {
        label: b.label,
        sort: b.sort,
        present: 0,
        absent: 0,
        counted: 0,
        rate: 0,
        presentUp: 0,
        absentDown: 0,
      };
      byPeriod.set(b.sort, row);
    }
    row.present += b.present;
    row.absent += b.absent;
    row.counted += b.counted;
  }

  return Array.from(byPeriod.values())
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
    .map((r) => ({
      ...r,
      rate: r.counted > 0 ? Number(((r.present / r.counted) * 100).toFixed(1)) : 0,
      presentUp: r.present,
      absentDown: r.absent > 0 ? -r.absent : 0,
    }));
}

const GRANULARITY_TITLE: Record<AttendanceGranularity, string> = {
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

export function AttendanceOverviewChart({ overview }: { overview?: AttendanceOverview }) {
  const [granularity, setGranularity] = useState<AttendanceGranularity>('week');
  const [department, setDepartment] = useState(ALL);
  const [unit, setUnit] = useState(ALL);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const accent = useAccent();
  const presentColor = accent;
  const absentColor = lightenHex(accent, 0.52);

  // Defaulted rather than required: a client holding an older cached payload
  // has no attendanceOverview, and one missing field must not take the whole
  // dashboard down with it.
  const departments = overview?.departments ?? [];
  const units = overview?.units ?? [];

  const chartData = useMemo<ChartRow[]>(
    () => rollUp(overview?.buckets ?? [], granularity, department, unit),
    [overview, granularity, department, unit]
  );

  const scopeLabel = [
    department === ALL ? 'All departments' : department,
    unit === ALL ? 'all units' : unit,
  ].join(' · ');

  // A symmetric domain keeps the zero line centred, so "mostly present" and
  // "mostly absent" are read off the same scale.
  const domainMax = useMemo(() => {
    const max = chartData.reduce((m, r) => Math.max(m, r.present, r.absent), 0);
    const padded = max * 1.15;
    if (max === 0) return 4;
    if (padded <= 5) return Math.max(2, Math.ceil(padded));
    if (padded <= 10) return Math.ceil(padded / 2) * 2;
    if (padded <= 50) return Math.ceil(padded / 10) * 10;
    if (padded <= 100) return Math.ceil(padded / 25) * 25;
    if (padded <= 500) return Math.ceil(padded / 50) * 50;
    return Math.ceil(padded / 100) * 100;
  }, [chartData]);

  const yTicks = [-domainMax, -Math.round(domainMax / 2), 0, Math.round(domainMax / 2), domainMax];
  const radius: [number, number, number, number] = [14, 14, 2, 2];

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {GRANULARITY_TITLE[granularity]} Attendance Overview
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Present above · absent below · {scopeLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filter attendance by department"
            className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
          >
            <option value={ALL}>All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Filter attendance by unit"
            className="h-9 cursor-pointer rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--primary)]"
          >
            <option value={ALL}>All Units</option>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] p-0.5">
            {(['week', 'month', 'year'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGranularity(option)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                  granularity === option
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2 mt-3 flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: presentColor }} />
          <span className="text-xs text-[var(--text-secondary)]">Present</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: absentColor }} />
          <span className="text-xs text-[var(--text-secondary)]">Absent</span>
        </div>
      </div>

      <div className="h-[340px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed px-4 text-center text-[12.5px]"
               style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
            No attendance marked for {scopeLabel.toLowerCase()} in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
              barCategoryGap="38%"
              stackOffset="sign"
              onMouseLeave={() => setActiveIndex(null)}
            >
              <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="var(--border-main)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                // The lower half counts absences, so it reads as a magnitude
                // rather than a negative number of people.
                tickFormatter={(v: number) => String(Math.abs(Math.round(v)))}
                domain={[-domainMax, domainMax]}
                ticks={yTicks}
                width={42}
                allowDataOverflow
              />
              <ReferenceLine y={0} stroke="var(--border-main)" strokeWidth={1.25} />
              <Tooltip
                cursor={false}
                shared
                isAnimationActive={false}
                content={(props) => (
                  <OverviewTooltip
                    active={props.active}
                    payload={props.payload as unknown as Array<{ payload?: ChartRow }>}
                    presentColor={presentColor}
                    absentColor={absentColor}
                  />
                )}
              />
              <Bar
                dataKey="presentUp"
                name="Present"
                stackId="mirror"
                fill={presentColor}
                maxBarSize={24}
                radius={radius}
                {...BAR_ANIMATION}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`present-${index}`}
                    fill={presentColor}
                    fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.28}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="absentDown"
                name="Absent"
                stackId="mirror"
                fill={absentColor}
                maxBarSize={24}
                radius={radius}
                {...BAR_ANIMATION_STAGGER}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`absent-${index}`}
                    fill={absentColor}
                    fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.28}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
