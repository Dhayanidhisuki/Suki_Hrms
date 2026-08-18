"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Users,
  Building2,
  History,
  Boxes,
} from "lucide-react";
import { ReportHub } from "@/components/ReportHub";
import { DownloadCenter } from "@/components/DownloadCenter";
import { ChartContainer, CalibrationAgingDonut, TransactionVelocityChart } from "@/components/OverviewCharts";
import { apiGet } from "@/lib/apiClient";

export default function ReportsPage() {
  const [stats, setStats] = useState({
    tools: 0,
    due: 0,
    suppliers: 0,
    subcontractors: 0,
    issues: 0,
  });

  useEffect(() => {
    (async () => {
      const [kpi, due, suppliers, subcontractors, issues] = await Promise.all([
        apiGet<{ totalTools?: number }>("/api/dashboard/kpi"),
        apiGet<{ total?: number; items?: unknown[] }>("/api/tools/calibration-due"),
        apiGet<{ items?: unknown[] }>("/api/suppliers"),
        apiGet<{ items?: unknown[]; total?: number }>("/api/subcontractors"),
        apiGet<{ items?: unknown[] }>("/api/issue"),
      ]);
      setStats({
        tools: kpi.data?.totalTools ?? 0,
        due: due.data?.total ?? due.data?.items?.length ?? 0,
        suppliers: suppliers.data?.items?.length ?? 0,
        subcontractors: subcontractors.data?.total ?? subcontractors.data?.items?.length ?? 0,
        issues: issues.data?.items?.length ?? 0,
      });
    })();
  }, []);

  return (
    <ReportHub
      title="Reports & Analytics"
      subtitle="Operational summaries & visual analytical reports — view inline charts or export full datasets"
      kpis={[
        {
          id: "tools",
          label: "Tools Register",
          value: stats.tools,
          subtext: "GAUGEANDTOOLS",
          icon: Boxes,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Tools", type: "info" },
        },
        {
          id: "due",
          label: "Calib Due",
          value: stats.due,
          subtext: "Alert window",
          icon: CalendarClock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Calib", type: "warning" },
        },
        {
          id: "suppliers",
          label: "Suppliers",
          value: stats.suppliers,
          subtext: "Purchase vendors",
          icon: Users,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Buy", type: "info" },
        },
        {
          id: "subs",
          label: "Subcontractors",
          value: stats.subcontractors,
          subtext: "Labs & job-work",
          icon: Building2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Labs", type: "success" },
        },
      ]}
      chart={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartContainer title="Calibration Compliance Distribution" subtitle="System-wide gauge calibration health breakdown">
            <CalibrationAgingDonut />
          </ChartContainer>

          <ChartContainer title="Tool Issue & Return Velocity" subtitle="Monthly transaction activity summary">
            <TransactionVelocityChart />
          </ChartContainer>
        </div>
      }
      links={[
        {
          href: "/dashboard/reports/tools",
          title: "All Tool Reports",
          description: "Register size, ROL attention, and tools history entry points.",
          icon: BarChart3,
          metric: stats.tools,
          metricLabel: "tools tracked",
          badge: "Tools",
        },
        {
          href: "/dashboard/reports/calibration",
          title: "Calibration Reports",
          description: "Gauges due, active issue pipeline, and results log.",
          icon: CalendarClock,
          metric: stats.due,
          metricLabel: "due list items",
          badge: "Calib",
        },
        {
          href: "/dashboard/reports/suppliers",
          title: "Supplier Report",
          description: "Vendor master count, active status, and location split.",
          icon: Users,
          metric: stats.suppliers,
          metricLabel: "vendors",
          badge: "Buy",
        },
        {
          href: "/dashboard/reports/subcontractors",
          title: "Subcontractor Report",
          description: "Job-work and calibration lab roster summary.",
          icon: Building2,
          metric: stats.subcontractors,
          metricLabel: "subcontractors",
          badge: "Labs",
        },
        {
          href: "/dashboard/reports/tools-history",
          title: "Tools History Report",
          description: "Quick pivot into serial / tool history search.",
          icon: History,
          metric: stats.issues,
          metricLabel: "issue records",
          badge: "History",
        },
      ]}
    >
      <DownloadCenter />
    </ReportHub>
  );
}
