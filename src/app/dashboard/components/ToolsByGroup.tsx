"use client";

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import { useSession } from "@/lib/SessionContext";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
} from "recharts";
import type { PieSectorShapeProps } from "recharts/types/polar/Pie";
import {
  ChevronDown,
  CreditCard,
  Gauge,
  Layers,
  Package,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { apiGet } from "@/lib/apiClient";

interface GroupData {
  name: string;
  count: number;
}

type DisplayGroup = {
  name: string;
  count: number;
  pct: number;
  gradId: string;
  from: string;
  to: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
};

const TOP_N = 3;

/** Vibrant segment gradients matching the compact legend reference. */
const SEGMENT_STYLES = [
  { from: "#22d3ee", to: "#3b82f6", icon: ShoppingBag },
  { from: "#f43f5e", to: "#f97316", icon: Wrench },
  { from: "#38bdf8", to: "#2563eb", icon: Gauge },
  { from: "#c084fc", to: "#7c3aed", icon: CreditCard },
] as const;

const FALLBACK_ICONS = [Layers, Wrench, Gauge, Package] as const;

function isBlankGroupName(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  const upper = t.toUpperCase();
  return (
    upper === "-SELECT-" ||
    upper === "--SELECT--" ||
    upper === "SELECT" ||
    upper === "N/A" ||
    upper === "NA" ||
    upper === "NULL"
  );
}

function displayName(raw: string): string {
  if (isBlankGroupName(raw)) return "Ungrouped";
  return raw.trim();
}

function iconForName(name: string, index: number) {
  const n = name.toLowerCase();
  if (n.includes("consum")) return ShoppingBag;
  if (n.includes("gauge") || n.includes("tool")) return Wrench;
  if (n.includes("instrument") || n.includes("calib")) return Gauge;
  if (n.includes("other") || n.includes("ungroup")) return CreditCard;
  return SEGMENT_STYLES[index % SEGMENT_STYLES.length]?.icon ?? FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

function collapseToTopGroups(rows: GroupData[]): { groups: DisplayGroup[]; total: number } {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const name = displayName(row.name || "");
    if (row.count <= 0) continue;
    merged.set(name, (merged.get(name) ?? 0) + row.count);
  }

  const sorted = Array.from(merged.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const total = sorted.reduce((s, g) => s + g.count, 0);

  let slice: { name: string; count: number }[];
  if (sorted.length <= TOP_N + 1) {
    slice = sorted;
  } else {
    const top = sorted.slice(0, TOP_N);
    const otherCount = sorted.slice(TOP_N).reduce((s, g) => s + g.count, 0);
    slice = [...top, { name: "Other", count: otherCount }];
  }

  const groups: DisplayGroup[] = slice.map((g, i) => {
    const style = SEGMENT_STYLES[i % SEGMENT_STYLES.length];
    return {
      name: g.name,
      count: g.count,
      pct: total > 0 ? Math.round((g.count / total) * 100) : 0,
      gradId: `tools-group-grad-${i}`,
      from: style.from,
      to: style.to,
      icon: iconForName(g.name, i),
    };
  });

  return { groups, total };
}

function ActiveShape(props: PieSectorShapeProps) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
  } = props;

  const midAngle = (startAngle + endAngle) / 2;
  const RADIAN = Math.PI / 180;
  const offset = 10;
  const dx = Math.cos(-RADIAN * midAngle) * offset;
  const dy = Math.sin(-RADIAN * midAngle) * offset;

  return (
    <Sector
      cx={cx + dx}
      cy={cy + dy}
      innerRadius={innerRadius}
      outerRadius={Number(outerRadius) + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      style={{
        filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.28))",
        transition: "all 0.25s ease",
      }}
    />
  );
}

function InactiveShape(props: PieSectorShapeProps) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
  } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export default function ToolsByGroup() {
  const { canModule } = useSession();
  const [rawGroups, setRawGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    apiGet<{ groupBreakdown: GroupData[] }>("/api/dashboard/kpi").then((res) => {
      if (res.data?.groupBreakdown) setRawGroups(res.data.groupBreakdown);
      setLoading(false);
    });
  }, []);

  const { groups, total } = useMemo(() => collapseToTopGroups(rawGroups), [rawGroups]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (activeIndex >= groups.length) setActiveIndex(0);
  }, [groups.length, activeIndex]);

  const active = groups[activeIndex] ?? groups[0];
  const ActiveIcon = active?.icon ?? Package;

  return (
    <div
      className={`overflow-hidden rounded-[28px] border-[0.5px] border-[var(--border-main)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-opacity ${
        loading ? "opacity-60" : "opacity-100"
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] min-h-[380px]">
        {/* ── Left: chart panel + donut (theme tokens — works in light & dark) ── */}
        <div className="bg-[var(--bg-card)] text-[var(--text-primary)] flex flex-col p-6 sm:p-7 relative">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
              Tools By Group
            </h2>
            {canModule("reports") && (
              <Link
                href="/dashboard/reports/tools"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                Groups
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Link>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <p className="text-[15px] text-[var(--text-muted)] mb-1">
              Total:{" "}
              <span className="font-bold text-[var(--text-primary)] tabular-nums">
                {total.toLocaleString("en-IN")}
              </span>
            </p>

            <div className="relative w-full max-w-[280px] aspect-square">
              {groups.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {groups.map((g) => (
                          <linearGradient
                            key={g.gradId}
                            id={g.gradId}
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor={g.from} />
                            <stop offset="100%" stopColor={g.to} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={groups}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={3}
                        stroke="var(--bg-card)"
                        strokeWidth={4}
                        shape={(props: PieSectorShapeProps) => {
                          const selected = props.index === activeIndex;
                          return selected
                            ? ActiveShape(props)
                            : InactiveShape(props);
                        }}
                        onClick={(_, index) => setActiveIndex(index)}
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        style={{ cursor: "pointer" }}
                        isAnimationActive
                      >
                        {groups.map((entry) => (
                          <Cell
                            key={entry.gradId}
                            fill={`url(#${entry.gradId})`}
                            stroke="var(--bg-card)"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center label — selected segment */}
                  {active && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
                      <ActiveIcon
                        className="w-6 h-6 mb-1.5"
                        style={{ color: active.from }}
                      />
                      <p className="text-[13px] text-[var(--text-muted)] font-medium truncate max-w-full leading-tight">
                        {active.name}
                      </p>
                      <p className="text-[17px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5 leading-tight">
                        {active.count.toLocaleString("en-IN")}{" "}
                        <span className="text-[var(--text-subtle)] font-semibold">/</span>{" "}
                        {active.pct}%
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
                  {loading ? "Loading…" : "No group data"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: compact legend — themed (follows selected color theme) ── */}
        <div
          className="text-[var(--text-inverse)] flex flex-col p-5 sm:p-6 lg:rounded-r-[28px] transition-colors duration-300"
          style={{
            background: `linear-gradient(
              165deg,
              var(--logo-grad-1) 0%,
              color-mix(in srgb, var(--logo-grad-1) 78%, #000000) 55%,
              color-mix(in srgb, var(--primary) 18%, #050505) 100%
            )`,
          }}
        >
          <h3 className="text-[15px] font-semibold text-white/90 mb-4 tracking-wide">
            Legend:
          </h3>

          <div className="flex-1 flex flex-col gap-1.5">
            {groups.map((group, index) => {
              const Icon = group.icon;
              const selected = index === activeIndex;
              const label =
                group.name.toLowerCase() === "other"
                  ? "Other"
                  : group.name.toUpperCase();

              return (
                <button
                  key={group.gradId}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-all duration-200 ${
                    selected ? "" : "bg-transparent hover:bg-white/[0.06]"
                  }`}
                  style={
                    selected
                      ? {
                          background:
                            "color-mix(in srgb, var(--primary) 22%, rgba(0,0,0,0.35))",
                          boxShadow:
                            "inset 0 0 0 1px color-mix(in srgb, var(--primary) 40%, transparent)",
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: selected
                          ? "color-mix(in srgb, var(--primary) 28%, transparent)"
                          : `${group.from}22`,
                        color: selected ? "var(--primary)" : group.from,
                        boxShadow: selected
                          ? "0 0 0 1px color-mix(in srgb, var(--primary) 45%, transparent)"
                          : undefined,
                      }}
                    >
                      <Icon className="w-[15px] h-[15px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[12px] font-semibold truncate tracking-wide ${
                            selected ? "text-white" : "text-white/85"
                          }`}
                        >
                          {label}
                        </span>
                        <span className="text-[11px] font-medium text-white/45 tabular-nums shrink-0">
                          {group.count.toLocaleString("en-IN")} / {group.pct}%
                        </span>
                      </div>
                      <div
                        className={`rounded-full bg-white/[0.08] overflow-hidden ${
                          selected ? "h-[6px]" : "h-[4px]"
                        }`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(group.pct, group.count > 0 ? 3 : 0)
                            )}%`,
                            background: selected
                              ? "linear-gradient(90deg, var(--primary), var(--primary-hover))"
                              : `linear-gradient(90deg, ${group.from}, ${group.to})`,
                            boxShadow: selected
                              ? "0 0 10px color-mix(in srgb, var(--primary) 55%, transparent)"
                              : undefined,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {groups.length === 0 && (
              <p className="text-sm text-white/40 py-8 text-center">
                {loading ? "Loading…" : "No legend data"}
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <p className="text-[13px] text-white/55">
              Total:{" "}
              <span className="font-bold text-white tabular-nums">
                {total.toLocaleString("en-IN")}
              </span>
            </p>
            {canModule("reports") && (
              <Link
                href="/dashboard/reports/tools"
                className="text-[11px] font-semibold text-white/40 hover:text-[var(--primary)] transition-colors"
              >
                View all →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
