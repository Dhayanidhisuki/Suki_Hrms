"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, BadgeCheck, Store, Users } from "lucide-react";
import { ReportHub } from "@/components/ReportHub";
import { ReportBarChart, ReportChartCard } from "@/components/ReportCharts";
import { apiGet } from "@/lib/apiClient";

type Supplier = {
  supCode?: string;
  id?: number | string;
  subCode?: string;
  supName?: string;
  city?: string | null;
  state?: string | null;
  gstin?: string | null;
  status?: string | null;
  approvedSupplier?: string | null;
  isApproved?: boolean;
  phone1?: string | null;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Supplier[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: Supplier[] }>("/api/suppliers");
      setItems(res.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  const active = items.filter((s) => String(s.status ?? "").toUpperCase() === "ACTIVE").length;
  const approved = items.filter(
    (s) => s.isApproved === true || String(s.approvedSupplier ?? "").toUpperCase() === "YES"
  ).length;

  const stateChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of items) {
      const raw = String(s.state ?? "").trim();
      const key = !raw || /^(n\/a|any|select|-)$/i.test(raw) ? "Other / blank" : raw;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((n, [, c]) => n + c, 0);
    const data = top.map(([name, count]) => ({ name, count }));
    if (rest > 0) data.push({ name: "Other", count: rest });
    return data;
  }, [items]);

  return (
    <ReportHub
      title="Supplier Report"
      subtitle="Supplier master snapshot and pricing linkage"
      kpis={[
        {
          id: "total",
          label: "Total Suppliers",
          value: items.length,
          subtext: "SUPPLIER table",
          icon: Users,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Vendors", type: "info" },
        },
        {
          id: "active",
          label: "Active",
          value: active,
          subtext: "STATUS = ACTIVE",
          icon: Store,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Active", type: "success" },
        },
        {
          id: "approved",
          label: "Approved",
          value: approved,
          subtext: "Approved supplier flag",
          icon: BadgeCheck,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Approved", type: "info" },
        },
        {
          id: "inactive",
          label: "Inactive / Other",
          value: Math.max(items.length - active, 0),
          subtext: "Blocked or non-active",
          icon: Building2,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Other", type: "warning" },
        },
      ]}
      chart={
        <ReportChartCard
          title="Suppliers by state"
          subtitle="Top 8 states (+ Other) — STATE field from supplier master"
        >
          <ReportBarChart data={stateChart} horizontal />
        </ReportChartCard>
      }
      links={[
        {
          href: "/dashboard/masters/suppliers",
          title: "Supplier Master",
          description: "Maintain supplier codes, GSTIN, contacts, and approval status.",
          icon: Users,
          metric: items.length,
          metricLabel: "supplier records",
          badge: "Master",
        },
        {
          href: "/dashboard/masters/pricing",
          title: "Tool Pricing Master",
          description: "Rates linked by supplier / tool for purchase and costing views.",
          icon: BadgeCheck,
          metricLabel: "Pricing linkage",
          badge: "Pricing",
        },
      ]}
      previewTitle="Supplier register preview"
      footerNote="Live rows from SUPPLIER. Open Supplier Master for full filters and edits."
      previewLoading={loading}
      previewColumns={[
        { key: "supCode", label: "Code", mono: true },
        { key: "supName", label: "Name" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "gstin", label: "GSTIN", mono: true },
        { key: "status", label: "Status" },
      ]}
      previewRows={items.slice(0, 100) as Record<string, unknown>[]}
      exportCategory="suppliers"
    />
  );
}
