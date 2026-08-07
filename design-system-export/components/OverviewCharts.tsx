"use client";

import React, { ReactNode, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  ShieldAlert,
  GitBranch,
  Layers,
  ChevronRight,
  Activity,
  History,
  UserCheck,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import { BAR_ANIMATION, BAR_ANIMATION_STAGGER } from "@/components/BarChartEffects";

const tooltipStyle = {
  backgroundColor: "var(--bg-surface, #1e293b)",
  borderRadius: "12px",
  border: "1px solid var(--border-main, rgba(255,255,255,0.1))",
  color: "var(--text-primary, #ffffff)",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
  fontSize: "12px",
};

export function ChartContainer({
  title,
  subtitle,
  children,
  action,
  chartHeightClass = "h-64",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  chartHeightClass?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 sm:p-6 transition-all shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={`w-full ${chartHeightClass}`}>{children}</div>
    </div>
  );
}

/** 1. Transaction Velocity — combo bars + dashed trend line */
const PERIODS = [
  { id: "1d", label: "1 day" },
  { id: "1w", label: "1 week" },
  { id: "1m", label: "1 month" },
  { id: "1y", label: "1 year" },
  { id: "all", label: "All" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

type VelocityPoint = {
  label: string;
  /** null = no bar (future / no activity) */
  issue: number | null;
  receive: number | null;
  trend: number;
};

const ISSUE_BAR = "#3b82f6";
const RECEIVE_BAR = "#ec4899";
const TREND_STROKE = "#94a3b8";

const VELOCITY_BY_PERIOD: Record<PeriodId, VelocityPoint[]> = {
  "1d": [
    { label: "6a", issue: 420, receive: 210, trend: 310 },
    { label: "9a", issue: 1180, receive: 820, trend: 980 },
    { label: "12p", issue: 1640, receive: 1320, trend: 1420 },
    { label: "3p", issue: 1920, receive: 1680, trend: 1700 },
    { label: "6p", issue: 1480, receive: 1540, trend: 1280 },
    { label: "9p", issue: 640, receive: 880, trend: 720 },
  ],
  "1w": [
    { label: "M", issue: 1820, receive: 1140, trend: 980 },
    { label: "T", issue: 1240, receive: 860, trend: 1320 },
    { label: "W", issue: 1560, receive: 1420, trend: 1100 },
    { label: "T", issue: 980, receive: 740, trend: 860 },
    { label: "F", issue: 2100, receive: 1280, trend: 1180 },
    { label: "S", issue: 620, receive: 540, trend: 720 },
    { label: "S", issue: 380, receive: 290, trend: 540 },
  ],
  "1m": [
    { label: "W1", issue: 1680, receive: 920, trend: 880 },
    { label: "W2", issue: 2140, receive: 1480, trend: 1260 },
    { label: "W3", issue: 1920, receive: 1360, trend: 1420 },
    { label: "W4", issue: 2380, receive: 1620, trend: 1580 },
  ],
  // Matches reference: bars Jan–Aug, dashed trend through Dec
  "1y": [
    { label: "JAN", issue: 2250, receive: 1150, trend: 900 },
    { label: "FEB", issue: 1200, receive: 800, trend: 1400 },
    { label: "MAR", issue: 1300, receive: 1400, trend: 900 },
    { label: "APR", issue: 1000, receive: 700, trend: 720 },
    { label: "MAY", issue: 750, receive: 400, trend: 820 },
    { label: "JUN", issue: 1100, receive: 700, trend: 600 },
    { label: "JUL", issue: 2400, receive: 1200, trend: 920 },
    { label: "AUG", issue: 2150, receive: 1400, trend: 1500 },
    { label: "SEP", issue: null, receive: null, trend: 1100 },
    { label: "OCT", issue: null, receive: null, trend: 1450 },
    { label: "NOV", issue: null, receive: null, trend: 900 },
    { label: "DEC", issue: null, receive: null, trend: 700 },
  ],
  all: [
    { label: "JAN", issue: 2250, receive: 1150, trend: 900 },
    { label: "FEB", issue: 1200, receive: 800, trend: 1400 },
    { label: "MAR", issue: 1300, receive: 1400, trend: 900 },
    { label: "APR", issue: 1000, receive: 700, trend: 720 },
    { label: "MAY", issue: 750, receive: 400, trend: 820 },
    { label: "JUN", issue: 1100, receive: 700, trend: 600 },
    { label: "JUL", issue: 2400, receive: 1200, trend: 920 },
    { label: "AUG", issue: 2150, receive: 1400, trend: 1500 },
    { label: "SEP", issue: null, receive: null, trend: 1100 },
    { label: "OCT", issue: null, receive: null, trend: 1450 },
    { label: "NOV", issue: null, receive: null, trend: 900 },
    { label: "DEC", issue: null, receive: null, trend: 700 },
  ],
};

function VelocityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string | null;
    dataKey?: string | number;
    color?: string;
    name?: string;
  }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(
    (item) => item.value != null && item.dataKey !== "trendFill"
  );
  if (!rows.length) return null;

  return (
    <div className="rounded-xl bg-white border border-black/5 px-3 py-2.5 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.22)] min-w-[150px]">
      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">{label}</p>
      <div className="space-y-1">
        {rows.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color || TREND_STROKE }}
              />
              <span className="text-[11px] text-slate-600">{item.name}</span>
            </div>
            <span className="text-[12px] font-bold tabular-nums text-slate-900">
              {Number(item.value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionVelocityChart({
  data,
}: {
  data?: { month: string; issue: number; receive: number }[];
}) {
  const { theme } = useTheme();
  const primaryColor = THEMES[theme]?.dot || ISSUE_BAR;
  const [period, setPeriod] = useState<PeriodId>("1y");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const chartData = useMemo(() => {
    void refreshKey;
    if (data && (period === "all" || period === "1y")) {
      const byMonth = new Map(data.map((d) => [d.month.toUpperCase().slice(0, 3), d]));
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      return months.map((label) => {
        const row = byMonth.get(label) ?? byMonth.get(label.slice(0, 1) + label.slice(1).toLowerCase());
        const issue = row?.issue ?? null;
        const receive = row?.receive ?? null;
        const trend =
          issue != null || receive != null
            ? Math.round(((issue ?? 0) + (receive ?? 0)) / 2)
            : 0;
        return { label, issue, receive, trend };
      });
    }
    return VELOCITY_BY_PERIOD[period];
  }, [data, period, refreshKey]);

  const issueColor = theme === "blue" || !THEMES[theme] ? ISSUE_BAR : primaryColor;
  const receiveColor = RECEIVE_BAR;
  const inactiveBar = "color-mix(in srgb, var(--text-muted) 18%, var(--bg-subtle))";

  const yMax = useMemo(() => {
    let max = 0;
    for (const row of chartData) {
      max = Math.max(max, row.issue ?? 0, row.receive ?? 0, row.trend ?? 0);
    }
    if (max <= 100) return 100;
    if (max <= 500) return Math.ceil(max / 100) * 100;
    return Math.ceil(max / 500) * 500 || 3000;
  }, [chartData]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-main)]">
          {PERIODS.map((p) => {
            const selected = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  setActiveIndex(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[12px] transition-all ${
                  selected
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm"
                    : "text-[var(--text-muted)] font-medium hover:text-[var(--text-secondary)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Refresh"
            onClick={() => {
              setRefreshKey((k) => k + 1);
              setActiveIndex(null);
            }}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="More"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            key={refreshKey}
            data={chartData}
            margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
            barCategoryGap="32%"
            barGap={4}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id="txTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-main)"
              vertical
              horizontal
            />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: "var(--border-main)" }}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              domain={[0, yMax]}
              tickCount={7}
              width={44}
              tickFormatter={(v: number) =>
                v >= 1000 ? v.toLocaleString("en-US") : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: "color-mix(in srgb, var(--primary) 7%, transparent)" }}
              content={(props) => (
                <VelocityTooltip
                  active={props.active}
                  payload={props.payload as Array<{
                    value?: number | string | null;
                    dataKey?: string | number;
                    color?: string;
                    name?: string;
                  }>}
                  label={props.label as string | number | undefined}
                />
              )}
              isAnimationActive={false}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconSize={10}
              wrapperStyle={{ fontSize: "12px", paddingTop: 10 }}
              formatter={(value) => (
                <span className="text-[var(--text-secondary)] text-[12px]">{value}</span>
              )}
            />

            {/* Soft area under trend */}
            <Area
              type="monotone"
              dataKey="trend"
              name="trendFill"
              stroke="none"
              fill="url(#txTrendFill)"
              fillOpacity={1}
              legendType="none"
              tooltipType="none"
              isAnimationActive={false}
            />

            <Bar
              dataKey="issue"
              name="Tools Issued"
              fill={issueColor}
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              {...BAR_ANIMATION}
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {chartData.map((row, index) => (
                <Cell
                  key={`issue-${index}`}
                  fill={
                    row.issue == null
                      ? "transparent"
                      : activeIndex == null || activeIndex === index
                        ? issueColor
                        : inactiveBar
                  }
                />
              ))}
            </Bar>
            <Bar
              dataKey="receive"
              name="Tools Received"
              fill={receiveColor}
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              {...BAR_ANIMATION_STAGGER}
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {chartData.map((row, index) => (
                <Cell
                  key={`receive-${index}`}
                  fill={
                    row.receive == null
                      ? "transparent"
                      : activeIndex == null || activeIndex === index
                        ? receiveColor
                        : inactiveBar
                  }
                />
              ))}
            </Bar>

            {/* Dashed trend line across full range */}
            <Line
              type="monotone"
              dataKey="trend"
              name="Movement Trend"
              stroke={TREND_STROKE}
              strokeWidth={2}
              strokeDasharray="6 5"
              dot={false}
              activeDot={{ r: 4, fill: TREND_STROKE, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 2. Calibration Aging Donut — rounded caps + external % labels */
const CALIB_DONUT_COLORS = {
  healthy: "#84cc16",
  due30: "#38bdf8",
  due7: "#fb923c",
  overdue: "#fb7185",
} as const;

type CalibDonutItem = { name: string; value: number; color: string };

function CalibDonutLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
  fill?: string;
  index?: number;
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    percent = 0,
    name = "",
    fill = "#64748b",
  } = props;

  if (percent < 0.02) return null;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  const side = cos >= 0 ? 1 : -1;

  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;
  const mx = cx + (outerRadius + 36) * cos;
  const my = cy + (outerRadius + 36) * sin;
  const ex = mx + side * 18;
  const ey = my;
  const textAnchor = side === 1 ? "start" : "end";
  const pct = `${Math.round(percent * 100)}%`;

  return (
    <g>
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="var(--border-strong)"
        strokeWidth={1.25}
        strokeDasharray="2 3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={sx} cy={sy} r={2.5} fill={fill} stroke="var(--bg-card)" strokeWidth={1} />
      <text
        x={ex + side * 6}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        className="select-none"
      >
        <tspan
          x={ex + side * 6}
          dy="-0.45em"
          fill={fill}
          style={{ fontSize: 15, fontWeight: 700 }}
        >
          {pct}
        </tspan>
        <tspan
          x={ex + side * 6}
          dy="1.25em"
          fill="var(--text-secondary)"
          style={{ fontSize: 12, fontWeight: 500 }}
        >
          {name}
        </tspan>
      </text>
    </g>
  );
}

export function CalibrationAgingDonut({
  data = [
    { name: "Healthy", value: 145, color: CALIB_DONUT_COLORS.healthy },
    { name: "Due 30d", value: 32, color: CALIB_DONUT_COLORS.due30 },
    { name: "Due 7d", value: 14, color: CALIB_DONUT_COLORS.due7 },
    { name: "Overdue", value: 8, color: CALIB_DONUT_COLORS.overdue },
  ],
}: {
  data?: CalibDonutItem[];
}) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center">
      {/* Soft concentric backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, transparent 28%, color-mix(in srgb, var(--border-main) 55%, transparent) 28.5%, transparent 29%),
            radial-gradient(circle at 50% 50%, transparent 40%, color-mix(in srgb, var(--border-main) 40%, transparent) 40.5%, transparent 41%),
            radial-gradient(circle at 50% 50%, transparent 52%, color-mix(in srgb, var(--border-main) 30%, transparent) 52.5%, transparent 53%)
          `,
        }}
      />

      <div className="relative w-full max-w-[560px] aspect-square">
        {/* Floating white disc under the ring */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] aspect-square rounded-full bg-[var(--bg-card)] shadow-[0_18px_40px_-18px_rgba(15,23,42,0.28)] border border-[var(--border-main)]/40" />

        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 28, right: 48, bottom: 28, left: 48 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="68%"
              paddingAngle={6}
              cornerRadius={40}
              stroke="var(--bg-card)"
              strokeWidth={3}
              label={(props) => (
                <CalibDonutLabel
                  {...props}
                  fill={
                    (props.payload as CalibDonutItem | undefined)?.color ??
                    props.fill
                  }
                />
              )}
              labelLine={false}
              isAnimationActive
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="var(--bg-card)" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val: number | string, name: string) => {
                const n = Number(val) || 0;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return [`${n.toLocaleString()} (${pct}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.14em] font-semibold mt-1.5">
            Gauges
          </span>
        </div>
      </div>
    </div>
  );
}

/** 3. Purchase Spending & GRN Volume Chart */
export function PurchaseSpendingChart({
  data = [
    { month: "Jan", poCount: 8, amount: 45000 },
    { month: "Feb", poCount: 12, amount: 82000 },
    { month: "Mar", poCount: 15, amount: 110000 },
    { month: "Apr", poCount: 10, amount: 65000 },
    { month: "May", poCount: 18, amount: 140000 },
    { month: "Jun", poCount: 14, amount: 95000 },
  ],
}: {
  data?: { month: string; poCount: number; amount: number }[];
}) {
  const { theme } = useTheme();
  const primaryColor = THEMES[theme]?.dot || "#3b82f6";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
            <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`₹${Number(val || 0).toLocaleString()}`, "PO Spend"]} />
        <Area type="monotone" dataKey="amount" stroke={primaryColor} strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** 4. Stock Level Progress Battery Indicator */
export function StockBatteryMeter({
  currQty,
  rolQty,
  totQty = 100,
}: {
  currQty: number;
  rolQty: number;
  totQty?: number;
}) {
  const safeTotal = Math.max(totQty, rolQty, currQty, 1);
  const currentPct = Math.min(Math.round((currQty / safeTotal) * 100), 100);
  const rolPct = Math.min(Math.round((rolQty / safeTotal) * 100), 100);

  let statusColor = "bg-emerald-500";
  let statusText = "Safe Stock";
  let badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  if (currQty <= 0) {
    statusColor = "bg-rose-500";
    statusText = "Stock Out";
    badgeStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (currQty <= rolQty) {
    statusColor = "bg-rose-500";
    statusText = "Below Reorder Threshold";
    badgeStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (currQty <= rolQty * 1.2) {
    statusColor = "bg-amber-500";
    statusText = "Near Reorder Point";
    badgeStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--text-primary)]">{currQty} units</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeStyle}`}>
          {statusText} (ROL: {rolQty})
        </span>
      </div>
      <div className="relative w-full h-3 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-main)]">
        {/* Fill bar */}
        <div
          className={`h-full transition-all duration-300 ${statusColor}`}
          style={{ width: `${currentPct}%` }}
        />
        {/* ROL Threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
          style={{ left: `${rolPct}%` }}
          title={`Reorder Level Threshold: ${rolQty}`}
        />
      </div>
    </div>
  );
}

/** 5. Tool Lifecycle Visual Timeline Node Stepper */
export function VisualLifecycleTimeline({
  toolNo,
  toolName,
  creatDt,
  qtyIn,
  qtyOut,
  lastCalibDate,
  nextCalibDate,
}: {
  toolNo: string;
  toolName: string;
  creatDt?: string | null;
  qtyIn?: number | string;
  qtyOut?: number | string;
  lastCalibDate?: string | null;
  nextCalibDate?: string | null;
}) {
  const steps = [
    {
      id: "registered",
      title: "Tool Creation & Registration",
      date: creatDt ? new Date(creatDt).toLocaleDateString() : "Master Record Created",
      desc: `Registered as ${toolNo} - ${toolName}`,
      icon: Package,
      status: "done",
    },
    {
      id: "inventory",
      title: "Store Inventory Status",
      date: `Stock In: ${qtyIn ?? 0} | Out: ${qtyOut ?? 0}`,
      desc: Number(qtyOut) > 0 ? "Currently checked out on shop floor" : "Available in Store Crib",
      icon: Number(qtyOut) > 0 ? ArrowUpRight : ArrowDownLeft,
      status: Number(qtyOut) > 0 ? "active" : "done",
    },
    {
      id: "calibration",
      title: "Calibration Cycle Record",
      date: lastCalibDate ? `Last: ${lastCalibDate.split("T")[0]}` : "Calibration Cycle Registered",
      desc: nextCalibDate ? `Next Due: ${nextCalibDate.split("T")[0]}` : "Standard Calibration Interval",
      icon: Clock,
      status: nextCalibDate && new Date(nextCalibDate) < new Date() ? "alert" : "done",
    },
  ];

  return (
    <div className="space-y-4 py-2">
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-main)]">
        {steps.map((step) => {
          const Icon = step.icon;
          let nodeBg = "bg-[var(--primary)] text-white";
          if (step.status === "active") nodeBg = "bg-blue-500 text-white animate-pulse";
          if (step.status === "alert") nodeBg = "bg-rose-500 text-white";

          return (
            <div key={step.id} className="relative flex items-start gap-3.5 group">
              <div
                className={`absolute -left-6 top-0.5 w-6.5 h-6.5 rounded-full flex items-center justify-center shadow-sm text-xs font-semibold ${nodeBg}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl p-3.5 flex-1 hover:border-[var(--primary)]/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">{step.title}</h4>
                  <span className="text-[10px] font-mono font-medium text-[var(--text-muted)]">
                    {step.date}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 6. Interactive Node Hierarchy Tree (Tool Mapping) */
export function HierarchyNodeTree({
  groups = [],
}: {
  groups?: { name: string; subgroups: { name: string; count: number }[] }[];
}) {
  const defaultGroups = [
    {
      name: "CUTTING TOOLS",
      subgroups: [
        { name: "DRILLS & REAMERS", count: 24 },
        { name: "ENDMILLS & CUTTERS", count: 18 },
      ],
    },
    {
      name: "GAUGES & MEASURING",
      subgroups: [
        { name: "VERNIERS & MICROMETERS", count: 32 },
        { name: "THREAD PLUG & RING GAUGES", count: 45 },
      ],
    },
  ];

  const activeData = groups.length > 0 ? groups : defaultGroups;

  return (
    <div className="space-y-4 p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)]">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-4 h-4 text-[var(--primary)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Interactive Tool Hierarchy Map</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeData.map((g) => (
          <div
            key={g.name}
            className="bg-[var(--bg-subtle)] rounded-xl p-4 border border-[var(--border-main)] space-y-3"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-main)]">
              <Layers className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
                {g.name}
              </span>
            </div>
            <div className="space-y-2">
              {g.subgroups.map((sg) => (
                <div
                  key={sg.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card)] text-xs border border-[var(--border-main)] hover:border-[var(--primary)]/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span className="font-medium text-[var(--text-primary)]">{sg.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--primary-light)] text-[var(--primary)]">
                    {sg.count} items
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 7. System Activity & Audit Log Histogram */
export function LogActivityHistogram({
  data = [
    { hour: "08:00", create: 12, update: 45, delete: 2 },
    { hour: "10:00", create: 25, update: 82, delete: 5 },
    { hour: "12:00", create: 18, update: 60, delete: 1 },
    { hour: "14:00", create: 30, update: 95, delete: 4 },
    { hour: "16:00", create: 22, update: 70, delete: 3 },
    { hour: "18:00", create: 8, update: 28, delete: 0 },
  ],
}: {
  data?: { hour: string; create: number; update: number; delete: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
        <Bar
          dataKey="update"
          name="Modifications / Edits"
          fill="#3b82f6"
          stackId="a"
          radius={[0, 0, 0, 0]}
          {...BAR_ANIMATION}
        />
        <Bar
          dataKey="create"
          name="New Creations"
          fill="#10b981"
          stackId="a"
          radius={[0, 0, 0, 0]}
          {...BAR_ANIMATION_STAGGER}
        />
        <Bar
          dataKey="delete"
          name="Deletions / Scraps"
          fill="#ef4444"
          stackId="a"
          radius={[6, 6, 0, 0]}
          {...BAR_ANIMATION}
          animationBegin={140}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
