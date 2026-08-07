"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ReportHub } from "@/components/ReportHub";
import { ReportChartCard, ReportDonutChart } from "@/components/ReportCharts";
import { apiGet } from "@/lib/apiClient";

type DueRow = {
  toolOrGaugeNo?: string;
  name?: string | null;
  grouping?: string | null;
  status?: string | null;
  nextCalibrationDate?: string | null;
  nextCDate?: string | null;
  frequency?: string | null;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const [pendingResults, setPendingResults] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [rows, setRows] = useState<DueRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [due, issues, results] = await Promise.all([
        apiGet<{ items: DueRow[]; total?: number }>("/api/tools/calibration-due"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/issue"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/results-update"),
      ]);

      const items = due.data?.items ?? [];
      setDueCount(due.data?.total ?? items.length);
      setIssueCount(issues.data?.total ?? issues.data?.items?.length ?? 0);
      setPendingResults(results.data?.total ?? results.data?.items?.length ?? 0);

      const today = Date.now();
      setOverdue(
        items.filter((r) => {
          const d = r.nextCalibrationDate ?? r.nextCDate;
          return d ? new Date(d).getTime() < today : false;
        }).length
      );
      setRows(items.slice(0, 100));
      setLoading(false);
    })();
  }, []);

  const pieData = useMemo(() => {
    // Mutually exclusive mix: upcoming due (window − overdue) + overdue + open calib issues.
    // Pending Results stays out — different pipeline stage, not a due-mix bucket.
    const dueUpcoming = Math.max(0, dueCount - overdue);
    return [
      { name: "Due", value: dueUpcoming, color: "#38bdf8" },
      { name: "Overdue", value: overdue, color: "#f43f5e" },
      { name: "Calib Issues", value: issueCount, color: "#3b82f6" },
    ];
  }, [dueCount, overdue, issueCount]);

  return (
    <ReportHub
      title="Calibration Reports"
      subtitle="Due dates, open issues, and pending results from calibration transactions"
      kpis={[
        {
          id: "due",
          label: "Due in Window",
          value: dueCount,
          subtext: "NXT_CALIB_DATE / CALIB_DUE_DATE",
          icon: CalendarClock,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Due", type: "info" },
        },
        {
          id: "overdue",
          label: "Overdue",
          value: overdue,
          subtext: "Past next calibration date",
          icon: ShieldAlert,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Alert", type: "warning" },
        },
        {
          id: "issues",
          label: "Calib Issues",
          value: issueCount,
          subtext: "TOOLS_ISSUE_FOR_CALIBRATION",
          icon: FileSpreadsheet,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Issues", type: "info" },
        },
        {
          id: "pending",
          label: "Pending Results",
          value: pendingResults,
          subtext: "Awaiting pass / fail update",
          icon: Clock,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Results", type: "success" },
        },
      ]}
      chartBesideLinks
      chart={
        <ReportChartCard
          title="Calibration due mix"
          subtitle="Due soon vs overdue vs open calibration issues"
          className="mb-0 h-full"
        >
          <ReportDonutChart data={pieData} centerSubtext="total" />
        </ReportChartCard>
      }
      links={[
        {
          href: "/dashboard/calibration/due-list",
          title: "Calibration Due List",
          description: "Tools due or overdue for calibration, sorted by next due date.",
          icon: CalendarClock,
          metric: dueCount,
          metricLabel: "tools in alert window",
          badge: "Due",
        },
        {
          href: "/dashboard/calibration/results-update",
          title: "Results Update",
          description: "Record PASSED / FAILED / RECALIBRATED against open issue lines.",
          icon: ClipboardCheck,
          metric: pendingResults,
          metricLabel: "pending updates",
          badge: "Results",
        },
        {
          href: "/dashboard/tools-history-card/calibration",
          title: "Calibration Records",
          description: "Issue history slice for calibration DCs and lab parties.",
          icon: CheckCircle2,
          metric: issueCount,
          metricLabel: "issue headers",
          badge: "History",
        },
      ]}
      previewTitle="Calibration due preview"
      footerNote="Earliest due tools from issue-line dates. Open Due List for filters."
      previewLoading={loading}
      previewColumns={[
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "name", label: "Name" },
        { key: "grouping", label: "Group" },
        { key: "frequency", label: "Frequency" },
        { key: "nextCalibrationDate", label: "Next Due" },
        { key: "status", label: "Status" },
      ]}
      previewRows={rows.map((r) => ({
        ...r,
        nextCalibrationDate: r.nextCalibrationDate ?? r.nextCDate,
      })) as Record<string, unknown>[]}
      previewRowDownload={{
        label: "PDF",
        getUrl: (row) => {
          const toolNo = String(row.toolOrGaugeNo ?? "").trim();
          if (!toolNo) return null;
          return `/api/tools/calibration-due/pdf?toolOrGaugeNo=${encodeURIComponent(toolNo)}`;
        },
        getFilename: (row) => {
          const safe = String(row.toolOrGaugeNo ?? "tool").replace(/[^\w\-]+/g, "_");
          return `Calibration_Record_${safe}.pdf`;
        },
      }}
      exportCategory="calibration"
    />
  );
}
