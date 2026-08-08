"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import { BAR_ANIMATION, BarChartLoadingSkeleton } from "@/components/BarChartEffects";

const ACCENT = {
  sky: "#38bdf8",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#a78bfa",
};

/** Progress card ring colors (match reference: teal / orange / purple) */
const PROGRESS_COLORS = {
  available: "#2DD4BF",
  issued: "#FB923C",
  underCal: "#A78BFA",
  track: "#EEF2F7",
} as const;

const tooltipStyle = {
  backgroundColor: "var(--bg-surface)",
  borderRadius: "12px",
  border: "1px solid var(--border-main)",
  color: "var(--text-primary)",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  fontSize: "12px",
};

export function ReportChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional layout overrides (e.g. h-full mb-0 when beside link cards) */
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6 flex flex-col ${className}`}
    >
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-64 w-full min-h-[16rem] flex-1">{children}</div>
    </div>
  );
}

export function ReportBarChart({
  data,
  xKey = "name",
  yKey = "count",
  horizontal = false,
  loading = false,
}: {
  data: Record<string, string | number>[];
  xKey?: string;
  yKey?: string;
  horizontal?: boolean;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const primary = THEMES[theme]?.dot || THEMES.blue.dot;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (loading) {
    return <BarChartLoadingSkeleton color={primary} horizontal={horizontal} />;
  }

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
        No chart data available
      </div>
    );
  }

  const tick = { fill: "var(--text-muted)", fontSize: 11 };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 16, left: horizontal ? 4 : -8, bottom: 4 }}
        barCategoryGap="28%"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          vertical={horizontal}
          horizontal={!horizontal}
          stroke="var(--border-main)"
          strokeOpacity={0.85}
        />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={tick}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              width={118}
              axisLine={false}
              tickLine={false}
              tick={tick}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={tick}
              interval={0}
              angle={data.length > 6 ? -20 : 0}
              textAnchor={data.length > 6 ? "end" : "middle"}
              height={data.length > 6 ? 56 : 30}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={tick}
              allowDecimals={false}
            />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--bg-hover)" }}
          isAnimationActive={false}
        />
        <Bar
          dataKey={yKey}
          fill={primary}
          radius={horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]}
          maxBarSize={28}
          {...BAR_ANIMATION}
          onMouseEnter={(_, index) => setActiveIndex(index)}
        >
          {data.map((_, index) => (
            <Cell
              key={`bar-${index}`}
              fill={primary}
              fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.28}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type DonutDatum = { name: string; value: number; color?: string };

function donutBadgeLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
}) {
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, percent = 0, value = 0 } = props;
  if (!value || percent <= 0) return null;

  const RADIAN = Math.PI / 180;
  // Sit just outside the ring at the arc midpoint
  const r = outerRadius + 16;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const label = `${(percent * 100).toFixed(1)}%`;
  const pillW = Math.max(44, label.length * 7.2 + 14);
  const pillH = 20;

  return (
    <g>
      <rect
        x={x - pillW / 2}
        y={y - pillH / 2}
        width={pillW}
        height={pillH}
        rx={999}
        ry={999}
        fill="var(--bg-app)"
        stroke="var(--border-main)"
        strokeWidth={0.75}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-primary)"
        style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </text>
    </g>
  );
}

/** Segmented donut with gaps, rounded caps, center total, and % badges (Recharts). */
export function ReportDonutChart({
  data,
  centerLabel,
  centerSubtext = "total",
}: {
  data: DonutDatum[];
  /** Override center number (defaults to sum of segment values) */
  centerLabel?: string | number;
  centerSubtext?: string;
}) {
  const { theme } = useTheme();
  const primary = THEMES[theme]?.dot || THEMES.blue.dot;
  const palette = [ACCENT.rose, ACCENT.amber, primary, ACCENT.emerald, ACCENT.sky];
  const chartData = data.filter((d) => d.value > 0);
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const displayTotal = centerLabel ?? total;

  if (total <= 0 || chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
        No chart data available
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="relative flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 12, right: 28, bottom: 8, left: 28 }}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="78%"
              paddingAngle={chartData.length > 1 ? 5 : 3}
              cornerRadius={12}
              stroke="none"
              label={donutBadgeLabel}
              labelLine={false}
              isAnimationActive
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={`donut-seg-${idx}-${entry.name}`}
                  fill={entry.color || palette[idx % palette.length]}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value) || 0;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return [`${n.toLocaleString()} (${pct}%)`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] leading-none">
            {typeof displayTotal === "number" ? displayTotal.toLocaleString() : displayTotal}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {centerSubtext}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-1 shrink-0">
        {data.map((item, idx) => (
          <div key={`donut-legend-${idx}-${item.name}`} className="inline-flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color || palette[idx % palette.length] }}
            />
            <span className="text-[11px] text-[var(--text-muted)]">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportAreaChart({
  data,
  xKey = "month",
  yKey = "Issued",
}: {
  data: Record<string, string | number>[];
  xKey?: string;
  yKey?: string;
}) {
  const { theme } = useTheme();
  const primary = THEMES[theme]?.dot || THEMES.blue.dot;

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
        No chart data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="reportAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={yKey} stroke={primary} fill="url(#reportAreaFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatPeriodRange(from: Date, to: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)} - ${fmt(to)}`;
}

function ProgressRingSkeleton() {
  return (
    <div className="relative h-full w-full flex items-center justify-center" role="status" aria-label="Loading progress">
      <div className="relative w-[78%] max-w-[280px] aspect-square">
        {[
          { inset: "8%", color: PROGRESS_COLORS.underCal },
          { inset: "22%", color: PROGRESS_COLORS.issued },
          { inset: "36%", color: PROGRESS_COLORS.available },
        ].map((ring, i) => (
          <div
            key={i}
            className="absolute rounded-full border-[12px] animate-pulse"
            style={{
              inset: ring.inset,
              borderColor: ring.color,
              opacity: 0.28,
              animationDelay: `${i * 140}ms`,
            }}
          />
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="h-2.5 w-16 rounded-full bg-[var(--bg-subtle)] animate-pulse" />
          <div className="h-8 w-14 rounded-lg bg-[var(--bg-subtle)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Concentric radial progress card (reference Progress UI).
 * Rings = Available / Issued / Under Cal as % of register; center = available %.
 */
export function ReportProgressChart({
  totalTools,
  currentlyIssued,
  underRepairOrCal,
  loading = false,
  detailHref = "/dashboard/masters/tools",
  className = "",
}: {
  totalTools: number;
  currentlyIssued: number;
  underRepairOrCal: number;
  loading?: boolean;
  detailHref?: string;
  className?: string;
}) {
  const issued = Math.max(0, Math.min(currentlyIssued, totalTools));
  const underCal = Math.max(0, Math.min(underRepairOrCal, Math.max(0, totalTools - issued)));
  const available = Math.max(0, totalTools - issued - underCal);
  const pct = (n: number) =>
    totalTools > 0 ? Math.min(100, Math.max(0, Math.round((n / totalTools) * 100))) : 0;

  const availablePct = pct(available);
  const issuedPct = pct(issued);
  const underCalPct = pct(underCal);

  const periodLabel = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 63);
    return formatPeriodRange(from, to);
  }, []);

  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    if (loading) {
      setDisplayPct(0);
      return;
    }
    const target = availablePct;
    let frame = 0;
    const frames = 28;
    const id = window.setInterval(() => {
      frame += 1;
      const t = Math.min(1, frame / frames);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(Math.round(target * eased));
      if (t >= 1) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [loading, availablePct]);

  // Inner → outer: teal Available, orange Issued, purple Under Cal
  const chartData = [
    {
      name: "Available",
      short: "Available",
      value: availablePct,
      count: available,
      fill: PROGRESS_COLORS.available,
    },
    {
      name: "Issued",
      short: "Issued",
      value: issuedPct,
      count: issued,
      fill: PROGRESS_COLORS.issued,
    },
    {
      name: "Under Cal",
      short: "Under Cal",
      value: underCalPct,
      count: underCal,
      fill: PROGRESS_COLORS.underCal,
    },
  ];

  const legend = [
    { label: "Available", value: available, color: PROGRESS_COLORS.available },
    { label: "Issued", value: issued, color: PROGRESS_COLORS.issued },
    { label: "Under Cal", value: underCal, color: PROGRESS_COLORS.underCal },
  ];

  return (
    <div
      className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-[0_10px_30px_-12px_rgba(15,23,42,0.12)] p-5 flex flex-col min-h-[320px] ${className}`}
    >
      <div className="flex items-start justify-between gap-3 shrink-0 mb-2">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
            Progress
          </h2>
          <button
            type="button"
            className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label={`Period ${periodLabel}`}
          >
            {periodLabel}
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
        <Link
          href={detailHref}
          className="shrink-0 inline-flex items-center justify-center rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
        >
          View Detail
        </Link>
      </div>

      <div className="relative flex-1 min-h-[240px] w-full">
        {loading || totalTools <= 0 ? (
          loading ? (
            <ProgressRingSkeleton />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
              No register data yet
            </div>
          )
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                key={`progress-${available}-${issued}-${underCal}-${totalTools}`}
                cx="42%"
                cy="50%"
                innerRadius="38%"
                outerRadius="92%"
                barSize={16}
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: PROGRESS_COLORS.track }}
                  dataKey="value"
                  cornerRadius={999}
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={1100}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={`progress-ring-${idx}`} fill={entry.fill} />
                  ))}
                </RadialBar>
                <Tooltip
                  cursor={false}
                  contentStyle={tooltipStyle}
                  formatter={(value, _name, item) => {
                    const n = typeof value === "number" ? value : Number(value) || 0;
                    const count = Number(item?.payload?.count ?? 0);
                    return [`${count.toLocaleString()} (${n}%)`, String(item?.payload?.name ?? "")];
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>

            <div className="absolute left-[42%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-[11px] text-[var(--text-muted)] font-medium leading-none mb-1.5">
                Available
              </div>
              <div className="text-[34px] font-bold tabular-nums tracking-tight text-[var(--text-primary)] leading-none">
                {displayPct}%
              </div>
            </div>

            <div className="absolute right-1 bottom-[14%] flex flex-col gap-2.5 pointer-events-none">
              {legend.map((item, idx) => (
                <div key={`progress-legend-${idx}`} className="inline-flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: item.color }}>
                    {item.label}: {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
