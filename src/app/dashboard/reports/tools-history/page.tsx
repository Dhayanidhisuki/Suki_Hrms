"use client";

import { useEffect, useState } from "react";
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarClock,
  Package,
} from "lucide-react";
import { ReportHub } from "@/components/ReportHub";
import { ReportAreaChart, ReportChartCard } from "@/components/ReportCharts";
import { apiGet } from "@/lib/apiClient";

type IssueRow = {
  dcNo?: number;
  receiveName?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  empId?: string | number | null;
  lines?: unknown[];
  inHouseLines?: unknown[];
};

type MonthlyTrend = { month: string; Added?: number; Issued?: number; Received?: number };

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState(0);
  const [receives, setReceives] = useState(0);
  const [calibIssues, setCalibIssues] = useState(0);
  const [due, setDue] = useState(0);
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [monthlyIssued, setMonthlyIssued] = useState<MonthlyTrend[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [issueRes, recvRes, calibRes, dueRes, kpiRes] = await Promise.all([
        apiGet<{ items: IssueRow[] }>("/api/issue"),
        apiGet<{ items: unknown[] }>("/api/receive"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/issue"),
        apiGet<{ items: unknown[]; total?: number }>("/api/tools/calibration-due"),
        apiGet<{ monthlyTrends?: MonthlyTrend[] }>("/api/dashboard/kpi"),
      ]);

      const issueItems = issueRes.data?.items ?? [];
      setIssues(issueItems.length);
      setReceives(recvRes.data?.items?.length ?? 0);
      setCalibIssues(calibRes.data?.total ?? calibRes.data?.items?.length ?? 0);
      setDue(dueRes.data?.total ?? dueRes.data?.items?.length ?? 0);
      setRows(issueItems.slice(0, 100));
      setMonthlyIssued(kpiRes.data?.monthlyTrends ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ReportHub
      title="Tools History Report"
      subtitle="Cross-cutting movement history across issue, receive, and calibration"
      kpis={[
        {
          id: "issues",
          label: "Tool Issues",
          value: issues,
          subtext: "Recent GAUGE_TOOLS_ISSUE",
          icon: ArrowUpRight,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Issue", type: "info" },
        },
        {
          id: "receives",
          label: "Tool Receives",
          value: receives,
          subtext: "Recent returns",
          icon: ArrowDownLeft,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Receive", type: "success" },
        },
        {
          id: "calib",
          label: "Calib Issues",
          value: calibIssues,
          subtext: "Calibration DC headers",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Calib", type: "info" },
        },
        {
          id: "due",
          label: "Calib Due",
          value: due,
          subtext: "Due / overdue tools",
          icon: CalendarClock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Due", type: "warning" },
        },
      ]}
      chart={
        <ReportChartCard
          title="Issues by month"
          subtitle="Last 6 months Issued count from dashboard KPI monthlyTrends"
        >
          <ReportAreaChart data={monthlyIssued} xKey="month" yKey="Issued" />
        </ReportChartCard>
      }
      links={[
        {
          href: "/dashboard/tools-history-card",
          title: "History Card Hub",
          description: "Status, holder, issue/receive/calib/GRN views in one place.",
          icon: History,
          metricLabel: "Hub",
          badge: "Hub",
        },
        {
          href: "/dashboard/tools-history-card/issue",
          title: "Issue History",
          description: "Tool issue movements with party, due date, and line detail.",
          icon: ArrowUpRight,
          metric: issues,
          metricLabel: "recent issues",
          badge: "Issue",
        },
        {
          href: "/dashboard/tools-history-card/receive",
          title: "Receive History",
          description: "Return movements closing open issues back into stock.",
          icon: ArrowDownLeft,
          metric: receives,
          metricLabel: "recent receives",
          badge: "Receive",
        },
      ]}
      previewTitle="Recent issue history preview"
      footerNote="Latest tool issue headers. Open History Card for per-tool drill-down."
      previewLoading={loading}
      previewColumns={[
        { key: "dcNo", label: "DC No", mono: true },
        { key: "receiveName", label: "Party / Holder" },
        { key: "issueDate", label: "Issue Date" },
        { key: "dueDate", label: "Due Date" },
        { key: "status", label: "Status" },
      ]}
      previewRows={rows as Record<string, unknown>[]}
      exportCategory="tools-history"
    />
  );
}
