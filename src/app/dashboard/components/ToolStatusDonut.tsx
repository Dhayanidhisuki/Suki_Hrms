"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import { MoreVertical, ShieldCheck } from "lucide-react";

interface StatusData {
  status: string;
  count: number;
}

interface RingConfig {
  name: string;
  value: number;
  color: string;
  radius: number;
  strokeWidth: number;
}

export default function ToolStatusDonut() {
  const { theme } = useTheme();
  const [rawStatus, setRawStatus] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ statusBreakdown: StatusData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.statusBreakdown) {
        setRawStatus(res.data.statusBreakdown);
      }
      setLoading(false);
    });
  }, []);

  const primaryColor = THEMES[theme]?.dot || THEMES.blue.dot;

  const STATUS_COLORS: Record<string, string> = {
    Issued: primaryColor,
    Available: "#22c55e",
    "Under Calibration": "#f59e0b",
    "Under Repair": "#ef4444",
    Scrapped: "#94a3b8",
  };

  const total = rawStatus.reduce((sum, s) => sum + s.count, 0);
  const availableCount = rawStatus.find((s) => s.status === "Available")?.count ?? 0;
  const availablePct = total > 0 ? Math.round((availableCount / total) * 100) : 0;

  // Concentric rings
  const ringDefs = [
    { key: "Issued", color: primaryColor, radius: 82, strokeWidth: 9 },
    { key: "Available", color: "#22c55e", radius: 70, strokeWidth: 9 },
    { key: "Under Calibration", color: "#f59e0b", radius: 58, strokeWidth: 9 },
    { key: "Under Repair", color: "#ef4444", radius: 46, strokeWidth: 9 },
  ];

  const rings: RingConfig[] = ringDefs.map((def) => {
    const found = rawStatus.find((s) => s.status === def.key);
    return {
      name: def.key,
      value: found ? found.count : 0,
      color: def.color,
      radius: def.radius,
      strokeWidth: def.strokeWidth,
    };
  });

  const bottomLegend = [
    {
      name: "Available",
      value: availableCount,
      color: "#22c55e",
    },
    {
      name: "Issued",
      value: rawStatus.find((s) => s.status === "Issued")?.count ?? 0,
      color: primaryColor,
    },
    {
      name: "Cal. / Repair",
      value:
        (rawStatus.find((s) => s.status === "Under Calibration")?.count ?? 0) +
        (rawStatus.find((s) => s.status === "Under Repair")?.count ?? 0),
      color: "#f59e0b",
    },
  ];

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 flex flex-col justify-between h-full">
      <div>
        {/* ── Card Header ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Tool Status Breakdown
          </h2>
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-hover)]">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* ── Concentric Radial Gauge Chart ── */}
        <div className="relative flex items-center justify-center py-2">
          <svg className="w-56 h-56" viewBox="0 0 200 200">
            {rings.map((ring) => {
              const circ = 2 * Math.PI * ring.radius;
              const pct = total > 0 ? ring.value / total : 0;
              const effectivePct = ring.value > 0 ? Math.max(pct, 0.05) : 0;
              const dashArray = `${effectivePct * circ} ${circ}`;

              return (
                <g key={ring.name}>
                  {/* Faint background track */}
                  <circle
                    cx="100"
                    cy="100"
                    r={ring.radius}
                    fill="none"
                    stroke={ring.color}
                    strokeOpacity={0.2}
                    strokeWidth={ring.strokeWidth}
                  />
                  {/* Foreground progress arc */}
                  {ring.value > 0 && (
                    <circle
                      cx="100"
                      cy="100"
                      r={ring.radius}
                      fill="none"
                      stroke={ring.color}
                      strokeWidth={ring.strokeWidth}
                      strokeDasharray={dashArray}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      transform="rotate(-90 100 100)"
                      className="transition-all duration-700 ease-out"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-extrabold text-[var(--text-primary)] leading-none tabular-nums">
              {loading ? 0 : total.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Total Tools
            </span>
          </div>
        </div>

        {/* ── Middle Gap Fill: Operational Details ── */}
        <div className="my-4 p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Operational Readiness
              </span>
            </div>
            <span className="text-xs font-bold text-[var(--color-success-text)] bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full border border-[var(--border-main)]">
              {availablePct}% Available
            </span>
          </div>

          {/* Segmented Status Bar */}
          <div className="h-2 w-full bg-[var(--bg-hover)] rounded-full overflow-hidden flex">
            {rawStatus.map((s) => {
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={s.status}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: STATUS_COLORS[s.status] || "#94a3b8",
                  }}
                />
              );
            })}
          </div>

          {/* Detailed Status Breakdown Rows */}
          <div className="space-y-1.5 pt-1">
            {rawStatus.length > 0 ? (
              rawStatus.map((s) => {
                const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : "0.0";
                const color = STATUS_COLORS[s.status] || "#94a3b8";
                return (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[var(--text-secondary)] font-medium">{s.status}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-[var(--text-primary)]">{s.count.toLocaleString()}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">({pct}%)</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[var(--text-muted)] text-center py-1">Loading status details...</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Legend ── */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--border-main)]">
        {bottomLegend.map((item) => (
          <div key={item.name} className="flex items-center gap-2.5">
            <div
              className="w-1.5 h-8 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-[var(--text-primary)] leading-none tabular-nums">
                {item.value.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)] font-medium leading-tight mt-1 truncate">
                {item.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
