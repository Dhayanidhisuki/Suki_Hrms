"use client";

import { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";

const ACCENT = {
  sky: "#38bdf8",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#a78bfa",
};

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
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export function ReportBarChart({
  data,
  xKey = "name",
  yKey = "count",
  horizontal = false,
}: {
  data: Record<string, string | number>[];
  xKey?: string;
  yKey?: string;
  horizontal?: boolean;
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
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal || undefined} stroke="var(--border-main)" />
        {horizontal ? (
          <>
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey={xKey}
              width={110}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} interval={0} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 56 : 30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-hover)" }} />
        <Bar dataKey={yKey} fill={primary} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportDonutChart({
  data,
}: {
  data: { name: string; value: number; color?: string }[];
}) {
  const { theme } = useTheme();
  const primary = THEMES[theme]?.dot || THEMES.blue.dot;
  const palette = [ACCENT.rose, ACCENT.amber, primary, ACCENT.emerald, ACCENT.sky];
  const filtered = data.filter((d) => d.value > 0);
  const chartData = filtered.length ? filtered : data;

  if (!data.some((d) => d.value > 0)) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
        No chart data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
        >
          {chartData.map((entry, idx) => (
            <Cell key={entry.name} fill={entry.color || palette[idx % palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          verticalAlign="bottom"
          height={28}
          wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
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
