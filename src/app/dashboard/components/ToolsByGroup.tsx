"use client";

import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";

interface GroupData {
  name: string;
  count: number;
}

export default function ToolsByGroup() {
  const { theme } = useTheme();
  const [toolsByGroup, setToolsByGroup] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ groupBreakdown: GroupData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.groupBreakdown) {
        setToolsByGroup(res.data.groupBreakdown);
      }
      setLoading(false);
    });
  }, []);

  const primaryColor = THEMES[theme]?.dot || THEMES.blue.dot;
  const maxCount = Math.max(1, ...toolsByGroup.map((g) => g.count));
  const totalTools = toolsByGroup.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 flex flex-col justify-between">
      <div>
        {/* ── Card header ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Tools By Group
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Grouped by GaugeAndTools.grouping
            </p>
          </div>
          <button
            id="tools-by-group-refresh-btn"
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Column headers ── */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Grouping
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Count
          </span>
        </div>

        {/* ── Bar rows ── */}
        <div className={`space-y-3 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
          {toolsByGroup.map((group, idx) => {
            const pct = Math.round((group.count / maxCount) * 100);
            const sharePct = totalTools > 0 ? ((group.count / totalTools) * 100).toFixed(1) : "0.0";
            const barColor = idx === 0 ? primaryColor : idx === 1 ? "#38bdf8" : idx === 2 ? "#818cf8" : "var(--text-muted)";

            return (
              <div key={group.name} className="group">
                {/* Label row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: barColor }}
                    />
                    <span className="text-xs text-[var(--text-secondary)] font-medium truncate max-w-[150px]">
                      {group.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)]">{sharePct}%</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] w-8 text-right tabular-nums">
                      {group.count}
                    </span>
                  </div>
                </div>

                {/* Bar track */}
                <div className="h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer totals ── */}
      <div className="mt-5 pt-4 border-t border-[var(--border-main)] flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">
          {toolsByGroup.length} groupings tracked
        </span>
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Total:{" "}
          <span className="text-[var(--text-primary)]">
            {totalTools.toLocaleString()} tools
          </span>
        </span>
      </div>
    </div>
  );
}
