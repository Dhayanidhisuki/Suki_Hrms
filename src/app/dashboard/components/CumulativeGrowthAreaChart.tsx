"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";

interface GrowthData {
  month: string;
  Cumulative: number;
}

export default function CumulativeGrowthAreaChart() {
  const { theme } = useTheme();
  const [data, setData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ cumulativeGrowth: GrowthData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.cumulativeGrowth) {
        setData(res.data.cumulativeGrowth);
      }
      setLoading(false);
    });
  }, []);

  const primaryColor = THEMES[theme]?.dot || THEMES.blue.dot;

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Tools Inventory Growth
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Cumulative registered tools over time
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]">
          Running Total
        </span>
      </div>

      <div className={`h-64 w-full transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-surface)",
                borderRadius: "12px",
                border: "1px solid var(--border-main)",
                color: "var(--text-primary)",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="Cumulative"
              stroke={primaryColor}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#primaryAreaGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
