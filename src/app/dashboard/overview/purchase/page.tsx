"use client";

import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ChartContainer, PurchaseSpendingChart } from "@/components/OverviewCharts";
import { Package, Users, Building2, FileText } from "lucide-react";

export default function Page() {
  return (
    <SimpleMasterShell title="Purchase Overview" subtitle="GRN volume, PO procurement spending trends, and vendor masters">
      <div className="space-y-6">
        {/* Graphical Representation: Purchase Spending Chart */}
        <ChartContainer
          title="Monthly Procurement & PO Spend Trend"
          subtitle="Total spend volume and purchase order count tracking over recent months"
        >
          <PurchaseSpendingChart />
        </ChartContainer>

        {/* Quick Link Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link
            href="/dashboard/po-linked/receive"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Goods Receipt Note</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">TOOLS_PO_RECEIVE & GRN logs</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/masters/suppliers"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Supplier Master</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Registered tooling suppliers</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/masters/subcontractors"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-purple-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Subcontractor Master</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Calibration labs & job-work</p>
            </div>
            <span className="text-xs font-mono text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/po-linked/purchase-order"
            className="group flex items-start justify-between bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Purchase Order</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Open PO tracking</p>
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
