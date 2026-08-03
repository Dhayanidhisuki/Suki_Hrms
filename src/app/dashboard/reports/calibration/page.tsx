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
  const [dueItems, setDueItems] = useState<DueRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [due, issues, results] = await Promise.all([
        apiGet<{ items: DueRow[]; total?: number }>("/api/tools/calibration-due"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/issue"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/results-update"),
      ]);

      const items = due.data?.items ?? [];
      setDueItems(items);
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
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let overdueCount = 0;
    let dueThisMonth = 0;
    let dueLater = 0;

    for (const r of dueItems) {
      const raw = r.nextCalibrationDate ?? r.nextCDate;
      if (!raw) {
        dueLater += 1;
        continue;
      }
      const dt = new Date(raw);
      if (dt.getTime() < now.getTime()) overdueCount += 1;
      else if (dt.getTime() <= monthEnd.getTime()) dueThisMonth += 1;
      else dueLater += 1;
    }

    return [
      { name: "Overdue", value: overdueCount, color: "#f43f5e" },
      { name: "Due this month", value: dueThisMonth, color: "#f59e0b" },
      { name: "Due later (in window)", value: dueLater, color: "#38bdf8" },
    ];
  }, [dueItems]);

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
      chart={
        <ReportChartCard
          title="Calibration due mix"
          subtitle="Overdue vs due this month vs later in the alert window"
        >
          <ReportDonutChart data={pieData} />
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
      exportCategory="calibration"
    />
  );
}
