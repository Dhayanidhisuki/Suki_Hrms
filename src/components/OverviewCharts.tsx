"use client";

import React, { ReactNode } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  ShieldAlert,
  GitBranch,
  Layers,
  ChevronRight,
  Activity,
  History,
  UserCheck,
} from "lucide-react";

const tooltipStyle = {
  backgroundColor: "var(--bg-surface, #1e293b)",
  borderRadius: "12px",
  border: "1px solid var(--border-main, rgba(255,255,255,0.1))",
  color: "var(--text-primary, #ffffff)",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
  fontSize: "12px",
};

export function ChartContainer({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 transition-all shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

/** 1. Transaction Velocity Bar Chart (Issue vs Receive) */
export function TransactionVelocityChart({
  data = [
    { month: "Jan", issue: 42, receive: 38 },
    { month: "Feb", issue: 58, receive: 50 },
    { month: "Mar", issue: 65, receive: 62 },
    { month: "Apr", issue: 48, receive: 45 },
    { month: "May", issue: 72, receive: 68 },
    { month: "Jun", issue: 80, receive: 75 },
  ],
}: {
  data?: { month: string; issue: number; receive: number }[];
}) {
  const { theme } = useTheme();
  const primaryColor = THEMES[theme]?.dot || "#3b82f6";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
        <Bar dataKey="issue" name="Tools Issued" fill={primaryColor} radius={[6, 6, 0, 0]} />
        <Bar dataKey="receive" name="Tools Received" fill="#10b981" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 2. Calibration Aging Donut Chart */
export function CalibrationAgingDonut({
  data = [
    { name: "Healthy (>30d)", value: 145, color: "#10b981" },
    { name: "Due in 30 Days", value: 32, color: "#3b82f6" },
    { name: "Due in 7 Days", value: 14, color: "#f59e0b" },
    { name: "Overdue", value: 8, color: "#ef4444" },
  ],
}: {
  data?: { name: string; value: number; color: string }[];
}) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 h-full">
      <div className="h-48 w-48 relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-[var(--text-primary)]">{total}</span>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Gauges
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[var(--text-primary)] font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="font-semibold text-[var(--text-primary)]">{item.value}</span>
              <span className="text-[var(--text-muted)]">
                ({total ? Math.round((item.value / total) * 100) : 0}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 3. Purchase Spending & GRN Volume Chart */
export function PurchaseSpendingChart({
  data = [
    { month: "Jan", poCount: 8, amount: 45000 },
    { month: "Feb", poCount: 12, amount: 82000 },
    { month: "Mar", poCount: 15, amount: 110000 },
    { month: "Apr", poCount: 10, amount: 65000 },
    { month: "May", poCount: 18, amount: 140000 },
    { month: "Jun", poCount: 14, amount: 95000 },
  ],
}: {
  data?: { month: string; poCount: number; amount: number }[];
}) {
  const { theme } = useTheme();
  const primaryColor = THEMES[theme]?.dot || "#3b82f6";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
            <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`₹${Number(val || 0).toLocaleString()}`, "PO Spend"]} />
        <Area type="monotone" dataKey="amount" stroke={primaryColor} strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** 4. Stock Level Progress Battery Indicator */
export function StockBatteryMeter({
  currQty,
  rolQty,
  totQty = 100,
}: {
  currQty: number;
  rolQty: number;
  totQty?: number;
}) {
  const safeTotal = Math.max(totQty, rolQty, currQty, 1);
  const currentPct = Math.min(Math.round((currQty / safeTotal) * 100), 100);
  const rolPct = Math.min(Math.round((rolQty / safeTotal) * 100), 100);

  let statusColor = "bg-emerald-500";
  let statusText = "Safe Stock";
  let badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  if (currQty <= 0) {
    statusColor = "bg-rose-500";
    statusText = "Stock Out";
    badgeStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (currQty <= rolQty) {
    statusColor = "bg-rose-500";
    statusText = "Below Reorder Threshold";
    badgeStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (currQty <= rolQty * 1.2) {
    statusColor = "bg-amber-500";
    statusText = "Near Reorder Point";
    badgeStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--text-primary)]">{currQty} units</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeStyle}`}>
          {statusText} (ROL: {rolQty})
        </span>
      </div>
      <div className="relative w-full h-3 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-main)]">
        {/* Fill bar */}
        <div
          className={`h-full transition-all duration-300 ${statusColor}`}
          style={{ width: `${currentPct}%` }}
        />
        {/* ROL Threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
          style={{ left: `${rolPct}%` }}
          title={`Reorder Level Threshold: ${rolQty}`}
        />
      </div>
    </div>
  );
}

/** 5. Tool Lifecycle Visual Timeline Node Stepper */
export function VisualLifecycleTimeline({
  toolNo,
  toolName,
  creatDt,
  qtyIn,
  qtyOut,
  lastCalibDate,
  nextCalibDate,
}: {
  toolNo: string;
  toolName: string;
  creatDt?: string | null;
  qtyIn?: number | string;
  qtyOut?: number | string;
  lastCalibDate?: string | null;
  nextCalibDate?: string | null;
}) {
  const steps = [
    {
      id: "registered",
      title: "Tool Creation & Registration",
      date: creatDt ? new Date(creatDt).toLocaleDateString() : "Master Record Created",
      desc: `Registered as ${toolNo} - ${toolName}`,
      icon: Package,
      status: "done",
    },
    {
      id: "inventory",
      title: "Store Inventory Status",
      date: `Stock In: ${qtyIn ?? 0} | Out: ${qtyOut ?? 0}`,
      desc: Number(qtyOut) > 0 ? "Currently checked out on shop floor" : "Available in Store Crib",
      icon: Number(qtyOut) > 0 ? ArrowUpRight : ArrowDownLeft,
      status: Number(qtyOut) > 0 ? "active" : "done",
    },
    {
      id: "calibration",
      title: "Calibration Cycle Record",
      date: lastCalibDate ? `Last: ${lastCalibDate.split("T")[0]}` : "Calibration Cycle Registered",
      desc: nextCalibDate ? `Next Due: ${nextCalibDate.split("T")[0]}` : "Standard Calibration Interval",
      icon: Clock,
      status: nextCalibDate && new Date(nextCalibDate) < new Date() ? "alert" : "done",
    },
  ];

  return (
    <div className="space-y-4 py-2">
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-main)]">
        {steps.map((step) => {
          const Icon = step.icon;
          let nodeBg = "bg-[var(--primary)] text-white";
          if (step.status === "active") nodeBg = "bg-blue-500 text-white animate-pulse";
          if (step.status === "alert") nodeBg = "bg-rose-500 text-white";

          return (
            <div key={step.id} className="relative flex items-start gap-3.5 group">
              <div
                className={`absolute -left-6 top-0.5 w-6.5 h-6.5 rounded-full flex items-center justify-center shadow-sm text-xs font-semibold ${nodeBg}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl p-3.5 flex-1 hover:border-[var(--primary)]/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">{step.title}</h4>
                  <span className="text-[10px] font-mono font-medium text-[var(--text-muted)]">
                    {step.date}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 6. Interactive Node Hierarchy Tree (Tool Mapping) */
export function HierarchyNodeTree({
  groups = [],
}: {
  groups?: { name: string; subgroups: { name: string; count: number }[] }[];
}) {
  const defaultGroups = [
    {
      name: "CUTTING TOOLS",
      subgroups: [
        { name: "DRILLS & REAMERS", count: 24 },
        { name: "ENDMILLS & CUTTERS", count: 18 },
      ],
    },
    {
      name: "GAUGES & MEASURING",
      subgroups: [
        { name: "VERNIERS & MICROMETERS", count: 32 },
        { name: "THREAD PLUG & RING GAUGES", count: 45 },
      ],
    },
  ];

  const activeData = groups.length > 0 ? groups : defaultGroups;

  return (
    <div className="space-y-4 p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)]">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-4 h-4 text-[var(--primary)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Interactive Tool Hierarchy Map</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeData.map((g) => (
          <div
            key={g.name}
            className="bg-[var(--bg-subtle)] rounded-xl p-4 border border-[var(--border-main)] space-y-3"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-main)]">
              <Layers className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
                {g.name}
              </span>
            </div>
            <div className="space-y-2">
              {g.subgroups.map((sg) => (
                <div
                  key={sg.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card)] text-xs border border-[var(--border-main)] hover:border-[var(--primary)]/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span className="font-medium text-[var(--text-primary)]">{sg.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--primary-light)] text-[var(--primary)]">
                    {sg.count} items
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 7. System Activity & Audit Log Histogram */
export function LogActivityHistogram({
  data = [
    { hour: "08:00", create: 12, update: 45, delete: 2 },
    { hour: "10:00", create: 25, update: 82, delete: 5 },
    { hour: "12:00", create: 18, update: 60, delete: 1 },
    { hour: "14:00", create: 30, update: 95, delete: 4 },
    { hour: "16:00", create: 22, update: 70, delete: 3 },
    { hour: "18:00", create: 8, update: 28, delete: 0 },
  ],
}: {
  data?: { hour: string; create: number; update: number; delete: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
        <Bar dataKey="update" name="Modifications / Edits" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
        <Bar dataKey="create" name="New Creations" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
        <Bar dataKey="delete" name="Deletions / Scraps" fill="#ef4444" stackId="a" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
