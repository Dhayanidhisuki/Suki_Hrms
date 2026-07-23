"use client";

import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";

interface GroupData {
  name: string;
  count: number;
}

const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];

export default function ToolsByGroup() {
  const [toolsByGroup, setToolsByGroup] = useState<
    (GroupData & { color: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ groupBreakdown: GroupData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.groupBreakdown) {
        setToolsByGroup(
          res.data.groupBreakdown.map((g, i) => ({
            ...g,
            color: COLORS[i % COLORS.length],
          }))
        );
      }
      setLoading(false);
    });
  }, []);

  const maxCount = Math.max(1, ...toolsByGroup.map((g) => g.count));
  const totalTools = toolsByGroup.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      {/* ── Card header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Tools By Group
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Grouped by GaugeAndTools.grouping
          </p>
        </div>
        <button
          id="tools-by-group-refresh-btn"
          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Column headers ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Grouping (GaugeAndTools.grouping)
        </span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Count
        </span>
      </div>

      {/* ── Bar rows ── */}
      <div className={`space-y-3 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
        {toolsByGroup.map((group, idx) => {
          const pct = Math.round((group.count / maxCount) * 100);
          const sharePct = ((group.count / totalTools) * 100).toFixed(1);
          return (
            <div key={group.name} className="group">
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm text-slate-700 font-medium">
                    {group.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{sharePct}%</span>
                  <span className="text-sm font-semibold text-slate-800 w-8 text-right tabular-nums">
                    {group.count}
                  </span>
                </div>
              </div>

              {/* Bar track */}
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: group.color,
                    animationDelay: `${idx * 80}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer totals ── */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {toolsByGroup.length} groupings tracked
        </span>
        <span className="text-xs font-semibold text-slate-600">
          Total:{" "}
          <span className="text-slate-900">
            {totalTools.toLocaleString()} tools
          </span>
        </span>
      </div>
    </div>
  );
}
