"use client";

import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ChartContainer, TransactionVelocityChart } from "@/components/OverviewCharts";
import { ArrowUpRight, ArrowDownLeft, ClipboardList, ArrowLeftRight } from "lucide-react";

export default function Page() {
  return (
    <SimpleMasterShell title="Transaction Overview" subtitle="Live analytics, Issue/Receive velocity, and quick navigation">
      <div className="space-y-6">
        {/* Graphical Representation: Transaction Velocity Bar Chart */}
        <ChartContainer
          title="Monthly Transaction Movement Velocity"
          subtitle="Comparison of Tool Issues vs Returns across shopfloor & customers"
        >
          <TransactionVelocityChart />
        </ChartContainer>

        {/* Action Link Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link
            href="/dashboard/transactions/issue"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Tool Issue</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">GAUGE_TOOLS_ISSUE + Line Items</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/transactions/receive"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Tool Receive</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Return against open delivery challans</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/transactions/customer-receive"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight className="w-4 h-4 text-purple-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Receive From Customer</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">CUST_CODE filtered issue tracking</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/transactions/requisition-pending"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Requisition Pending</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Pending shopfloor approvals</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>
        </div>
      </div>
    </SimpleMasterShell>
  );
}
