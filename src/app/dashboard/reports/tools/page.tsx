"use client";

import { useEffect, useState } from "react";
import {
  Wrench,
  Package,
  History,
  AlertTriangle,
  Boxes,
  BarChart3,
} from "lucide-react";
import { ReportHub } from "@/components/ReportHub";
import { ReportBarChart, ReportChartCard } from "@/components/ReportCharts";
import { apiGet } from "@/lib/apiClient";

type ToolRow = {
  toolOrGaugeNo?: string;
  name?: string | null;
  grouping?: string | null;
  type?: string | null;
  status?: string | null;
  locationName?: string | null;
  totQty?: string | number | null;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [totalTools, setTotalTools] = useState(0);
  const [issued, setIssued] = useState(0);
  const [underCal, setUnderCal] = useState(0);
  const [groups, setGroups] = useState(0);
  const [groupBreakdown, setGroupBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [rows, setRows] = useState<ToolRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [kpi, tools] = await Promise.all([
        apiGet<{
          totalTools?: number;
          currentlyIssued?: number;
          underRepairOrCal?: number;
          groupBreakdown?: { name: string; count: number }[];
        }>("/api/dashboard/kpi"),
        apiGet<{ items: ToolRow[]; total?: number }>("/api/tools?pageSize=100"),
      ]);

      setTotalTools(kpi.data?.totalTools ?? tools.data?.total ?? 0);
      setIssued(kpi.data?.currentlyIssued ?? 0);
      setUnderCal(kpi.data?.underRepairOrCal ?? 0);
      const breakdown = kpi.data?.groupBreakdown ?? [];
      setGroupBreakdown(breakdown);
      setGroups(breakdown.length);
      setRows(tools.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ReportHub
      title="All Tool Reports"
      subtitle="Live summaries and exports over GAUGEANDTOOLS"
      kpis={[
        {
          id: "total-tools",
          label: "Total Tools",
          value: totalTools,
          subtext: "Active register size",
          icon: Boxes,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Register", type: "info" },
        },
        {
          id: "issued",
          label: "Currently Issued",
          value: issued,
          subtext: "Out on shop floor",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Issue", type: "info" },
        },
        {
          id: "under-cal",
          label: "Under Cal / Repair",
          value: underCal,
          subtext: "Calibration pipeline",
          icon: AlertTriangle,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Watch", type: "warning" },
        },
        {
          id: "groups",
          label: "Tool Groups",
          value: groups,
          subtext: "Grouping breakdown",
          icon: BarChart3,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Groups", type: "success" },
        },
      ]}
      chart={
        <ReportChartCard
          title="Tools by group"
          subtitle="Count by GROUPING from dashboard KPI (same breakdown as main Dashboard)"
        >
          <ReportBarChart data={groupBreakdown} horizontal />
        </ReportChartCard>
      }
      links={[
        {
          href: "/dashboard/masters/tools",
          title: "Item / Asset Master",
          description: "Full tools register with status, location, and stock quantities.",
          icon: Wrench,
          metric: totalTools,
          metricLabel: "tools in register",
          badge: "Master",
        },
        {
          href: "/dashboard/masters/reorder-level",
          title: "Reorder Level Report",
          description: "Tools at or below reorder buffer — procurement attention list.",
          icon: AlertTriangle,
          metricLabel: "ROL buffer view",
          badge: "Stock",
        },
        {
          href: "/dashboard/tools-history-card",
          title: "Tools History Card",
          description: "Per-tool movement history across issue, receive, calib, and GRN.",
          icon: History,
          metricLabel: "History hub",
          badge: "Trace",
        },
      ]}
      previewTitle="Tools register preview"
      footerNote="Latest tools from GAUGEANDTOOLS — open Item/Asset Master for the full list."
      previewLoading={loading}
      previewColumns={[
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "name", label: "Name" },
        { key: "grouping", label: "Group" },
        { key: "type", label: "Type" },
        { key: "status", label: "Status" },
        { key: "locationName", label: "Location" },
        { key: "totQty", label: "Qty" },
      ]}
      previewRows={rows as Record<string, unknown>[]}
      exportCategory="tools"
    />
  );
}
