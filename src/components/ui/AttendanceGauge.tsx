"use client";

/**
 * Semicircular attendance gauge.
 *
 * A half-donut rather than a full ring: the segments read left-to-right like a
 * meter, so "how much of the workforce is actually in today" is one glance
 * instead of a comparison between arcs. Recharts has no gauge primitive, so
 * this is a Pie swept from 180° to 0° with rounded caps.
 */

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { tooltipStyle } from "./ReportCharts";

export interface GaugeSegment {
  label: string;
  value: number;
  color: string;
}

export function AttendanceGauge({
  segments,
  centerValue,
  centerCaption,
  height = 240,
  cornerRadius = 12,
}: {
  segments: GaugeSegment[];
  /** Big number under the arc. Defaults to the segment total. */
  centerValue?: string | number;
  /** Small line under the number, e.g. "of 620 marked". */
  centerCaption?: string;
  height?: number;
  /** Rounding on the segment ends. Keep near half the ring thickness. */
  cornerRadius?: number;
}) {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  const drawn = useMemo(() => segments.filter((s) => s.value > 0), [segments]);

  return (
    <div className="flex w-full flex-col">
      {/* Legend above the arc, as in the reference. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">{s.label}</span>
          </span>
        ))}
      </div>

      {/* Capped and centred: the arc is sized off the container, so in a
          full-width card an uncapped gauge balloons and leaves the rows
          beneath it stranded at the bottom. */}
      <div className="relative mx-auto w-full max-w-[420px]" style={{ height }}>
        {total === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            Attendance has not been marked for today.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={drawn}
                  dataKey="value"
                  nameKey="label"
                  // cy at 88% puts the arc's flat edge near the bottom of the
                  // box, so the centre label sits inside the semicircle.
                  cx="50%"
                  cy="88%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius="112%"
                  outerRadius="165%"
                  paddingAngle={drawn.length > 1 ? 1 : 0}
                  // Not 999: on a slice only a degree or two wide, a corner
                  // radius larger than the arc is longer than the sector and
                  // Recharts renders it as a blob detached from the ring. A
                  // value near half the ring thickness caps the ends cleanly
                  // and degrades gracefully on a thin slice.
                  cornerRadius={cornerRadius}
                  stroke="none"
                  isAnimationActive
                >
                  {drawn.map((s) => (
                    <Cell key={s.label} fill={s.color} stroke="none" />
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

            <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex flex-col items-center">
              <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-[var(--text-primary)]">
                {centerValue ?? total.toLocaleString()}
              </span>
              {centerCaption && (
                <span className="mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {centerCaption}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
