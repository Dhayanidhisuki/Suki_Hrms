"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ChartContainer, PurchaseSpendingChart } from "@/components/OverviewCharts";
import { Package, Users, Building2, FileText } from "lucide-react";
import { apiGet } from "@/lib/apiClient";

export default function Page() {
  const [spend, setSpend] = useState<
    Array<{ month: string; poCount: number; amount: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiGet<{
        items?: Array<{ month: string; poCount: number; amount: number }>;
      }>("/api/po/spend?months=6");
      setSpend(res.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <SimpleMasterShell title="Purchase Overview" subtitle="GRN volume, PO procurement spending trends, and vendor masters">
      <div className="space-y-6">
        <ChartContainer
          title="Monthly Procurement & PO Spend Trend"
          subtitle={
            loading
              ? "Loading live COMMON_PURCHASE_ORDER spend…"
              : "Live spend from COMMON_PURCHASE_ORDER (Tools + ERP)"
          }
        >
          <PurchaseSpendingChart data={loading ? undefined : spend} />
        </ChartContainer>

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
