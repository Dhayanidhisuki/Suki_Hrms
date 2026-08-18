"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TransactionVelocityChart } from "@/components/OverviewCharts";
import { ArrowUpRight, ArrowDownLeft, ClipboardList, ArrowLeftRight } from "lucide-react";
import { apiGet } from "@/lib/apiClient";

type MovementMonth = {
  month: string;
  Issued?: number;
  Received?: number;
};

const cards = [
  {
    href: "/dashboard/transactions/issue",
    label: "Tool Issue",
    desc: "GAUGE_TOOLS_ISSUE + Line Items",
    icon: ArrowUpRight,
    iconClass: "text-emerald-500 bg-emerald-500/10",
  },
  {
    href: "/dashboard/transactions/receive",
    label: "Tool Receive",
    desc: "Return against open delivery challans",
    icon: ArrowDownLeft,
    iconClass: "text-blue-500 bg-blue-500/10",
  },
  {
    href: "/dashboard/transactions/customer-receive",
    label: "Receive From Customer",
    desc: "CUST_CODE filtered issue tracking",
    icon: ArrowLeftRight,
    iconClass: "text-purple-500 bg-purple-500/10",
  },
  {
    href: "/dashboard/transactions/requisition-pending",
    label: "Requisition Pending",
    desc: "Pending shopfloor approvals",
    icon: ClipboardList,
    iconClass: "text-amber-500 bg-amber-500/10",
  },
] as const;

export default function Page() {
  const [movementData, setMovementData] = useState<
    { month: string; issue: number; receive: number }[]
  >([]);

  useEffect(() => {
    apiGet<{ monthlyTrends?: MovementMonth[] }>("/api/dashboard/kpi").then((res) => {
      const rows = res.data?.monthlyTrends ?? [];
      setMovementData(
        rows.map((row) => ({
          month: row.month,
          issue: row.Issued ?? 0,
          receive: row.Received ?? 0,
        }))
      );
    });
  }, []);

  return (
    <SimpleMasterShell
      title="Tools Issue Overview"
      subtitle="Tool issue and receipt activity, trends, and quick navigation"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.8fr] gap-6 items-stretch">
        {/* Left: combo chart panel */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 sm:p-6 shadow-sm flex flex-col min-h-[480px]">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Issue & Receive Graph</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Comparison of Tool Issues vs Returns across shopfloor & customers
            </p>
          </div>
          <div className="flex-1 min-h-[380px]">
            <TransactionVelocityChart data={movementData.length ? movementData : undefined} />
          </div>
        </div>

        {/* Right: stacked KPI / nav cards */}
        <div className="flex flex-col gap-4 min-h-0">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="flex-1 group flex items-start gap-3.5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--primary)] transition-all shadow-sm"
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.iconClass}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                      {c.label}
                    </p>
                    <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      View →
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{c.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </SimpleMasterShell>
  );
}
