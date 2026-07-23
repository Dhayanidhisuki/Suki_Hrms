"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";

interface StatusData {
  status: string;
  count: number;
}

interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  Available: "#22c55e",
  Issued: "#3b82f6",
  "Under Calibration": "#f59e0b",
  "Under Repair": "#ef4444",
  Scrapped: "#94a3b8",
};

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: d.payload.color }}
        />
        <span className="font-semibold text-slate-800">{d.name}</span>
      </div>
      <p className="text-slate-500 text-xs">
        {d.value} tools{" "}
        <span className="text-slate-700 font-medium">({pct}%)</span>
      </p>
    </div>
  );
}

// Custom legend
function CustomLegend({ toolStatusData, total }: { toolStatusData: DonutDatum[]; total: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
      {toolStatusData.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 leading-tight truncate">
                {d.name}
              </p>
              <p className="text-xs font-semibold text-slate-800">
                {d.value}{" "}
                <span className="text-slate-400 font-normal">({pct}%)</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ToolStatusDonut() {
  const [toolStatusData, setToolStatusData] = useState<DonutDatum[]>([]);

  useEffect(() => {
    apiGet<{ statusBreakdown: StatusData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.statusBreakdown) {
        setToolStatusData(
          res.data.statusBreakdown.map((s) => ({
            name: s.status,
            value: s.count,
            color: STATUS_COLORS[s.status] ?? "#94a3b8",
          }))
        );
      }
    });
  }, []);

  const total = toolStatusData.reduce((s, d) => s + d.value, 0);
  const availablePct =
    total > 0
      ? Math.round(
          ((toolStatusData.find((d) => d.name === "Available")?.value ?? 0) /
            total) *
            100
        )
      : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Tool Status
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Driven by GaugeAndTools.status
          </p>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          {total} total
        </span>
      </div>

      {/* ── Donut ── */}
      <div className="h-44 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={toolStatusData}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {toolStatusData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label overlaid */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900 leading-none tabular-nums">
              {availablePct}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Available
            </p>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <CustomLegend toolStatusData={toolStatusData} total={total} />
    </div>
  );
}
