"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";

interface MonthlyData {
  month: string;
  Added: number;
  Issued: number;
  Received: number;
}

export default function MonthlyMovementsBarChart() {
  const { theme } = useTheme();
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ monthlyTrends: MonthlyData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.monthlyTrends) {
        setData(res.data.monthlyTrends);
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
            Monthly Tool Movements
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Added, Issued & Received activity (Last 6 Months)
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)]">
          Activity Trends
        </span>
      </div>

      <div className={`h-64 w-full transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <Legend
              wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }}
              iconType="circle"
            />
            <Bar dataKey="Added" fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Issued" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Received" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
