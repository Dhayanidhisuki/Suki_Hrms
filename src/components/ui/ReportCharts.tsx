"use client";

/**
 * Chart set ported from the Suki Tools module so both apps draw the same way:
 * same tooltip chrome, same dashed grid, same rounded caps, same entrance
 * animation, accent taken from the live theme.
 *
 * ReportBarChart / ReportDonutChart / ReportAreaChart / ReportChartCard come
 * from tools as-is. ReportStackedBarChart and ReportLineChart are additions —
 * HRMS needs a stacked series (leave by status) and a trend line (attrition),
 * which tools has no equivalent of; they follow the same conventions.
 */

import { ReactNode, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import { BAR_ANIMATION, BarChartLoadingSkeleton } from "./BarChartEffects";

const ACCENT = {
  sky: "#38bdf8",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#a78bfa",
};

export const tooltipStyle = {
  backgroundColor: "var(--bg-surface)",
  borderRadius: "12px",
  border: "1px solid var(--border-main)",
  color: "var(--text-primary)",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  fontSize: "12px",
};

const tick = { fill: "var(--text-muted)", fontSize: 11 };

/** The live theme's accent, as a concrete hex — Recharts cannot read CSS vars. */
export function useAccent() {
  const { theme } = useTheme();
  return THEMES[theme]?.dot || THEMES.blue.dot;
}

function NoData() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
      No chart data available
    </div>
  );
}

export function ReportChartCard({
  title,
  subtitle,
  children,
  className = "",
  action,
  height = 256,
  bodyClassName = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** Optional action shown in the header (e.g. Refresh). */
  action?: ReactNode;
  /**
   * Plot height in pixels. Set as an inline style, not a class, because
   * Recharts' ResponsiveContainer measures its parent: given only a
   * min-height on an auto-height flex child it resolves to 0 and the chart
   * renders nothing at all. A definite height is not optional here.
   */
  height?: number;
  /** Extra classes for the plot area. Never use this to set the height. */
  bodyClassName?: string;
}) {
  return (
    <div
      className={`mb-6 flex flex-col rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5 ${className}`}
    >
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={`w-full shrink-0 ${bodyClassName}`} style={{ height }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Any row shape. The charts only read the keys the caller names through
 * xKey / yKey / series, so constraining this to an index signature would
 * reject every typed payload interface for no benefit.
 */
type Row = object;
type Formatter = (value: number) => string;

export function ReportBarChart({
  data,
  xKey = "name",
  yKey = "count",
  horizontal = false,
  loading = false,
  color,
  seriesName,
  valueFormatter,
  axisFormatter,
  yAxisWidth,
  categoryWidth = 118,
  colorKey,
  opacityKey,
  xTickAngle,
  xTickHeight,
  xTickFontSize,
}: {
  data: Row[];
  xKey?: string;
  yKey?: string;
  horizontal?: boolean;
  loading?: boolean;
  /** Override the theme accent (e.g. a status colour). */
  color?: string;
  /** Series label shown in the tooltip. */
  seriesName?: string;
  /**
   * Formats the tooltip value. Receives the whole row too, so a caller can
   * append context the number alone does not carry (a status, a note).
   */
  valueFormatter?: (value: number, row?: Row) => string;
  /** Formats the value-axis ticks. */
  axisFormatter?: Formatter;
  yAxisWidth?: number;
  categoryWidth?: number;
  /**
   * Field on each row holding that bar's own colour. For a series where the
   * colour carries meaning per data point — an attendance flag, a status —
   * rather than identifying one series.
   */
  colorKey?: string;
  /** Field holding a per-bar fill opacity, e.g. to fade an empty day. */
  opacityKey?: string;
  /** Category-axis tick overrides, for a dense axis like days of a month. */
  xTickAngle?: number;
  xTickHeight?: number;
  xTickFontSize?: number;
}) {
  const accent = useAccent();
  const fill = color ?? accent;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (loading) return <BarChartLoadingSkeleton color={fill} horizontal={horizontal} />;
  if (!data.length) return <NoData />;

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
              tickFormatter={axisFormatter}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              width={categoryWidth}
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
              tick={xTickFontSize ? { ...tick, fontSize: xTickFontSize } : tick}
              interval={0}
              angle={xTickAngle ?? (data.length > 6 ? -20 : 0)}
              textAnchor={(xTickAngle ?? (data.length > 6 ? -20 : 0)) !== 0 ? "end" : "middle"}
              height={xTickHeight ?? (data.length > 6 ? 56 : 30)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={tick}
              allowDecimals={false}
              width={yAxisWidth}
              tickFormatter={axisFormatter}
            />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--bg-hover)" }}
          isAnimationActive={false}
          formatter={(value, _name, item) => {
            const n = typeof value === "number" ? value : Number(value) || 0;
            return [
              valueFormatter ? valueFormatter(n, item?.payload as Row) : n.toLocaleString(),
              seriesName ?? String(yKey),
            ] as [string, string];
          }}
        />
        <Bar
          dataKey={yKey}
          fill={fill}
          radius={horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]}
          maxBarSize={28}
          minPointSize={2}
          {...BAR_ANIMATION}
          onMouseEnter={(_, index) => setActiveIndex(index)}
        >
          {data.map((row, index) => {
            const own = colorKey ? (row as Record<string, unknown>)[colorKey] : undefined;
            const rowOpacity = opacityKey
              ? Number((row as Record<string, unknown>)[opacityKey] ?? 1)
              : 1;
            // Hover dimming multiplies the row's own opacity rather than
            // replacing it, so a faded bar stays faded while hovered.
            const dim = activeIndex == null || activeIndex === index ? 1 : 0.28;
            return (
              <Cell
                key={`bar-${index}`}
                fill={typeof own === "string" ? own : fill}
                fillOpacity={rowOpacity * dim}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked bars in the same visual language as ReportBarChart. */
export function ReportStackedBarChart({
  data,
  xKey = "label",
  series,
  loading = false,
}: {
  data: Row[];
  xKey?: string;
  series: Array<{ key: string; name: string; color: string }>;
  loading?: boolean;
}) {
  const accent = useAccent();
  if (loading) return <BarChartLoadingSkeleton color={accent} />;
  if (!data.length) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-main)" strokeOpacity={0.85} />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={tick} />
        <YAxis axisLine={false} tickLine={false} tick={tick} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-hover)" }} isAnimationActive={false} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="a"
            fill={s.color}
            maxBarSize={28}
            // Only the top segment gets the rounded cap, or the stack looks split.
            radius={i === series.length - 1 ? [10, 10, 0, 0] : undefined}
            {...BAR_ANIMATION}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}


/**
 * Grouped bars: one coloured series per row, side by side within each month.
 *
 * Distinct from ReportStackedBarChart — stacking answers "what does the total
 * consist of", grouping answers "how do these compare month to month", which
 * is what a department cross-tab is read for.
 */
export function ReportGroupedBarChart({
  columns,
  series,
  valueFormatter,
  axisFormatter,
  loading = false,
}: {
  /** Category-axis labels, e.g. the 12 FY months. */
  columns: string[];
  /** One entry per group; `values` is parallel to `columns`. */
  series: Array<{ name: string; values: number[]; color?: string }>;
  valueFormatter?: Formatter;
  axisFormatter?: Formatter;
  loading?: boolean;
}) {
  const accent = useAccent();
  const palette = [accent, ACCENT.emerald, ACCENT.amber, ACCENT.rose, ACCENT.violet, ACCENT.sky];

  if (loading) return <BarChartLoadingSkeleton color={accent} />;
  if (!series.length || !columns.length) return <NoData />;

  // Recharts wants a row per category with one key per series.
  const data = columns.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of series) row[s.name] = s.values[i] ?? 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: -4, bottom: 4 }} barCategoryGap="22%">
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-main)" strokeOpacity={0.85} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} />
        <YAxis axisLine={false} tickLine={false} tick={tick} tickFormatter={axisFormatter} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--bg-hover)" }}
          isAnimationActive={false}
          formatter={(value, name) => {
            const n = typeof value === "number" ? value : Number(value) || 0;
            return [valueFormatter ? valueFormatter(n) : n.toLocaleString(), String(name)];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          iconType="circle"
          iconSize={8}
        />
        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            fill={s.color ?? palette[i % palette.length]}
            radius={[6, 6, 0, 0]}
            maxBarSize={22}
            {...BAR_ANIMATION}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Trend line — same grid, ticks and tooltip as the rest of the set. */
export function ReportLineChart({
  data,
  xKey = "label",
  yKey = "value",
  color,
  seriesName,
  valueFormatter,
  loading = false,
}: {
  data: Row[];
  xKey?: string;
  yKey?: string;
  color?: string;
  seriesName?: string;
  valueFormatter?: Formatter;
  loading?: boolean;
}) {
  const accent = useAccent();
  const stroke = color ?? accent;

  if (loading) return <BarChartLoadingSkeleton color={stroke} />;
  if (!data.length) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-main)" strokeOpacity={0.85} />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={tick} />
        <YAxis axisLine={false} tickLine={false} tick={tick} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => {
            const n = typeof value === "number" ? value : Number(value) || 0;
            return [
              valueFormatter ? valueFormatter(n) : n.toLocaleString(),
              seriesName ?? String(yKey),
            ] as [string, string];
          }}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={stroke}
          strokeWidth={2}
          dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}


/**
 * Smooth multi-series lines — one soft curve per series over a shared category
 * axis, legend on top.
 *
 * Deliberately no dots: at 30 categories a dot per point turns the curve into
 * a dotted line, and the shape is what carries the meaning here. Hovering
 * still reveals the exact values through the shared tooltip.
 */
export function ReportMultiLineChart({
  columns,
  series,
  valueFormatter,
  axisFormatter,
  domain,
  loading = false,
  filled = false,
}: {
  columns: string[];
  series: Array<{ name: string; values: number[]; color?: string }>;
  valueFormatter?: Formatter;
  axisFormatter?: Formatter;
  domain?: [number, number];
  loading?: boolean;
  /** Gradient-filled, thicker rounded lines instead of the plain default. Opt-in per caller. */
  filled?: boolean;
}) {
  const accent = useAccent();
  const palette = [accent, ACCENT.emerald, ACCENT.amber, ACCENT.rose, ACCENT.violet, ACCENT.sky];

  if (loading) return <BarChartLoadingSkeleton color={accent} />;
  if (!series.length || !columns.length) return <NoData />;

  const data = columns.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of series) row[s.name] = s.values[i] ?? 0;
    return row;
  });

  if (!filled) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-main)" strokeOpacity={0.85} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval="preserveStartEnd" />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={tick}
            domain={domain}
            tickFormatter={axisFormatter}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            isAnimationActive={false}
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value) || 0;
              return [valueFormatter ? valueFormatter(n) : n.toLocaleString(), String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color ?? palette[i % palette.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? palette[i % palette.length];
            return (
              <linearGradient key={s.name} id={`multiLineFill-${s.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-main)" strokeOpacity={0.85} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval="preserveStartEnd" />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={tick}
          domain={domain}
          tickFormatter={axisFormatter}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          isAnimationActive={false}
          formatter={(value, name) => {
            const n = typeof value === "number" ? value : Number(value) || 0;
            return [valueFormatter ? valueFormatter(n) : n.toLocaleString(), String(name)];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
        {series.map((s, i) => {
          const color = s.color ?? palette[i % palette.length];
          return (
            <Area
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={color}
              fill={`url(#multiLineFill-${s.name})`}
              strokeWidth={3}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ReportAreaChart({
  data,
  xKey = "label",
  yKey = "value",
  color,
  seriesName,
  domain,
  axisFormatter,
  valueFormatter,
  loading = false,
}: {
  data: Row[];
  xKey?: string;
  yKey?: string;
  color?: string;
  seriesName?: string;
  domain?: [number, number];
  axisFormatter?: Formatter;
  valueFormatter?: Formatter;
  loading?: boolean;
}) {
  const accent = useAccent();
  const stroke = color ?? accent;
  // Gradient ids must not collide when two area charts share a page.
  const gradientId = `reportAreaFill-${String(yKey)}`;

  if (loading) return <BarChartLoadingSkeleton color={stroke} />;
  if (!data.length) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-main)" strokeOpacity={0.85} />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={tick} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={tick}
          allowDecimals={false}
          domain={domain}
          tickFormatter={axisFormatter}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => {
            const n = typeof value === "number" ? value : Number(value) || 0;
            return [
              valueFormatter ? valueFormatter(n) : n.toLocaleString(),
              seriesName ?? String(yKey),
            ] as [string, string];
          }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={stroke}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
        />
      </AreaChart>
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
  // Sit just outside the ring at the arc midpoint.
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

/** Segmented donut with gaps, rounded caps, a centre total and % badges. */
export function ReportDonutChart({
  data,
  centerLabel,
  centerSubtext = "total",
  showBadges = true,
  showLegend = true,
}: {
  data: DonutDatum[];
  /** Overrides the centre number, which otherwise sums the segments. */
  centerLabel?: string | number;
  centerSubtext?: string;
  /** Percentage pills around the ring; turn off in a narrow tile. */
  showBadges?: boolean;
  /** Turn off when the caller already lists the segments beside the ring. */
  showLegend?: boolean;
}) {
  const accent = useAccent();
  const palette = [ACCENT.rose, ACCENT.amber, accent, ACCENT.emerald, ACCENT.sky];
  const chartData = data.filter((d) => d.value > 0);
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const displayTotal = centerLabel ?? total;

  if (total <= 0 || chartData.length === 0) return <NoData />;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="relative min-h-0 flex-1">
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
              label={showBadges ? donutBadgeLabel : undefined}
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

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-1">
          <span className="text-2xl font-bold leading-none tracking-tight tabular-nums text-[var(--text-primary)]">
            {typeof displayTotal === "number" ? displayTotal.toLocaleString() : displayTotal}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {centerSubtext}
          </span>
        </div>
      </div>

      {showLegend && (
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-1">
        {data.map((item, idx) => (
          <div key={`donut-legend-${idx}-${item.name}`} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color || palette[idx % palette.length] }}
            />
            <span className="text-[11px] text-[var(--text-muted)]">{item.name}</span>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
