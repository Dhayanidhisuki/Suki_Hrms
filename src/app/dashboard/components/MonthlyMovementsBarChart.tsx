"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { apiGet } from "@/lib/apiClient";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import { BAR_ANIMATION, BAR_ANIMATION_STAGGER } from "@/components/BarChartEffects";

interface MonthlyData {
  month: string;
  year?: number;
  Added?: number;
  Issued?: number;
  Received?: number;
  thisPeriod?: number;
  previousPeriod?: number;
}

interface ChartRow {
  month: string;
  year: number;
  thisPeriod: number;
  previousPeriod: number;
  thisUp: number;
  prevDown: number;
  thisChange: number | null;
  prevChange: number | null;
  labelDate: string;
}

type TooltipItem = {
  payload?: ChartRow;
};

function formatAxisTick(value: number, useK: boolean): string {
  const abs = Math.abs(value);
  if (abs === 0) return useK ? "0k" : "0";
  if (useK) {
    const k = abs / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(Math.round(abs));
}

function formatPct(change: number | null): { text: string; positive: boolean } | null {
  if (change == null || !Number.isFinite(change)) return null;
  const positive = change >= 0;
  return {
    text: `${positive ? "+" : ""}${change.toFixed(1)}%`,
    positive,
  };
}

function pctChange(current: number, previous: number | undefined): number | null {
  if (previous == null || previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function lightenHex(hex: string, amount = 0.5): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

function MovementTooltip({
  active,
  payload,
  thisColor,
  prevColor,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  thisColor: string;
  prevColor: string;
}): ReactNode {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const thisPct = formatPct(row.thisChange);
  const prevPct = formatPct(row.prevChange);

  return (
    <div className="rounded-xl bg-white border border-black/5 px-3.5 py-3 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.22)] min-w-[168px]">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: thisColor }} />
          <span className="text-[13px] font-semibold tabular-nums text-slate-800">
            {row.thisPeriod.toLocaleString()}
          </span>
          {thisPct && (
            <span
              className={`ml-auto text-[11px] font-semibold tabular-nums ${
                thisPct.positive ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {thisPct.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: prevColor }} />
          <span className="text-[13px] font-semibold tabular-nums text-slate-800">
            {row.previousPeriod.toLocaleString()}
          </span>
          {prevPct && (
            <span
              className={`ml-auto text-[11px] font-semibold tabular-nums ${
                prevPct.positive ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {prevPct.text}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500">{row.labelDate}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
  );
}

/** Placeholder columns that pulse while KPI data loads (heights in px) */
const SKELETON_COLS = [
  { up: 72, down: 48 },
  { up: 118, down: 82 },
  { up: 64, down: 98 },
  { up: 136, down: 58 },
  { up: 90, down: 108 },
  { up: 112, down: 70 },
  { up: 78, down: 94 },
  { up: 124, down: 66 },
] as const;

function BarChartLoadingSkeleton({
  thisColor,
  prevColor,
}: {
  thisColor: string;
  prevColor: string;
}) {
  return (
    <div
      className="h-full w-full flex flex-col px-1 pt-2 pb-1"
      role="status"
      aria-label="Loading chart"
    >
      <div className="relative flex-1 min-h-0 flex items-stretch gap-[4.5%] px-[4%] pl-[48px]">
        <div
          className="absolute left-[48px] right-[2%] top-1/2 h-px -translate-y-1/2"
          style={{ backgroundColor: "var(--border-main)" }}
        />
        {SKELETON_COLS.map((col, i) => (
          <div key={i} className="relative flex-1 h-full">
            <div
              className="absolute left-1/2 bottom-[calc(50%+2px)] w-[55%] max-w-[22px] -translate-x-1/2"
              style={{ height: col.up }}
            >
              <div
                className="bar-chart-skeleton-bar h-full w-full rounded-t-[10px] rounded-b-[2px]"
                style={{
                  backgroundColor: thisColor,
                  animationDelay: `${i * 90}ms`,
                  transformOrigin: "bottom center",
                }}
              />
            </div>
            <div
              className="absolute left-1/2 top-[calc(50%+2px)] w-[55%] max-w-[22px] -translate-x-1/2"
              style={{ height: col.down }}
            >
              <div
                className="bar-chart-skeleton-bar h-full w-full rounded-b-[10px] rounded-t-[2px]"
                style={{
                  backgroundColor: prevColor,
                  animationDelay: `${i * 90 + 45}ms`,
                  transformOrigin: "top center",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between px-[8%] pl-[56px] pt-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-2 w-7 rounded-full bg-[var(--bg-subtle)] animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function MonthlyMovementsBarChart() {
  const { theme } = useTheme();
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    apiGet<{ monthlyTrends: MonthlyData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.monthlyTrends) setData(res.data.monthlyTrends);
      setLoading(false);
    });
  }, []);

  const primaryColor = THEMES[theme]?.dot || THEMES.blue.dot;
  const thisColor = primaryColor;
  const prevColor = lightenHex(primaryColor, 0.52);

  const chartData = useMemo<ChartRow[]>(() => {
    return data.map((row, index) => {
      const thisPeriod =
        row.thisPeriod ?? (row.Added ?? 0) + (row.Issued ?? 0) + (row.Received ?? 0);
      const previousPeriod = row.previousPeriod ?? 0;
      const prevThis =
        index > 0
          ? (data[index - 1].thisPeriod ??
              (data[index - 1].Added ?? 0) +
                (data[index - 1].Issued ?? 0) +
                (data[index - 1].Received ?? 0))
          : undefined;
      const prevPrev = index > 0 ? (data[index - 1].previousPeriod ?? 0) : undefined;
      const year = row.year ?? new Date().getFullYear();
      const parsed = Date.parse(`${row.month} 1, ${year}`);
      const mid = Number.isFinite(parsed)
        ? new Date(new Date(parsed).getFullYear(), new Date(parsed).getMonth(), 16)
        : new Date(year, 0, 16);

      return {
        month: row.month,
        year,
        thisPeriod,
        previousPeriod,
        // Positive → up, negative → down (stackOffset="sign")
        thisUp: thisPeriod,
        prevDown: previousPeriod > 0 ? -previousPeriod : 0,
        thisChange: pctChange(thisPeriod, prevThis),
        prevChange: pctChange(previousPeriod, prevPrev),
        labelDate: mid.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
    });
  }, [data]);

  const maxAbs = useMemo(() => {
    let max = 0;
    for (const row of chartData) {
      max = Math.max(max, row.thisPeriod, row.previousPeriod);
    }
    return max || 10;
  }, [chartData]);

  const useK = maxAbs >= 1000;

  const domainMax = useMemo(() => {
    const padded = maxAbs * 1.12;
    if (padded <= 10) return 10;
    if (padded <= 50) return Math.ceil(padded / 10) * 10;
    if (padded <= 100) return Math.ceil(padded / 25) * 25;
    if (padded <= 500) return Math.ceil(padded / 50) * 50;
    if (padded <= 1000) return Math.ceil(padded / 100) * 100;
    return Math.ceil(padded / 250) * 250;
  }, [maxAbs]);

  const yTicks = useMemo(
    () => [-domainMax, -Math.round(domainMax / 2), 0, Math.round(domainMax / 2), domainMax],
    [domainMax]
  );

  // Fully rounded outer tip; flat-ish near baseline (Recharts path handles neg height)
  const upRadius: [number, number, number, number] = [14, 14, 2, 2];
  const downRadius: [number, number, number, number] = [14, 14, 2, 2];

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border-[0.5px] border-[var(--border-main)] p-5 flex flex-col">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Monthly Tool Movements
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          This period vs previous period activity
        </p>
      </div>

      <div className="flex items-center gap-5 mb-2 mt-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: thisColor }} />
          <span className="text-xs text-[var(--text-secondary)]">This Period</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: prevColor }} />
          <span className="text-xs text-[var(--text-secondary)]">Previous Period</span>
        </div>
      </div>

      <div className="h-[340px] w-full">
        {loading ? (
          <BarChartLoadingSkeleton thisColor={thisColor} prevColor={prevColor} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
              barCategoryGap="38%"
              stackOffset="sign"
              onMouseLeave={() => setActiveIndex(null)}
            >
              <CartesianGrid
                strokeDasharray="2 6"
                vertical={false}
                stroke="var(--border-main)"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                tickFormatter={(v: number) => formatAxisTick(v, useK)}
                domain={[-domainMax, domainMax]}
                ticks={yTicks}
                width={42}
                allowDataOverflow
              />
              <ReferenceLine y={0} stroke="var(--border-main)" strokeWidth={1.25} />
              <Tooltip
                cursor={false}
                shared
                content={(props) => (
                  <MovementTooltip
                    active={props.active}
                    payload={props.payload as unknown as TooltipItem[] | undefined}
                    thisColor={thisColor}
                    prevColor={prevColor}
                  />
                )}
                isAnimationActive={false}
              />
              <Bar
                dataKey="thisUp"
                name="This Period"
                stackId="mirror"
                fill={thisColor}
                maxBarSize={24}
                radius={upRadius}
                {...BAR_ANIMATION}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`this-${index}`}
                    fill={thisColor}
                    fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.28}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="prevDown"
                name="Previous Period"
                stackId="mirror"
                fill={prevColor}
                maxBarSize={24}
                radius={downRadius}
                {...BAR_ANIMATION_STAGGER}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                style={{ filter: `drop-shadow(0 3px 4px ${prevColor}66)` }}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`prev-${index}`}
                    fill={prevColor}
                    fillOpacity={activeIndex == null || activeIndex === index ? 1 : 0.28}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
