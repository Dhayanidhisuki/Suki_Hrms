"use client";

import { Suspense, useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type ResultRow = {
  toolOrGaugeNo?: string | null;
  name?: string | null;
  type?: string | null;
  cDate?: string | null;
  nextCDate?: string | null;
  status?: string | null;
  dcNo?: string | null;
  frequency?: string | number | null;
  remarks?: string | null;
};

function ResultsPageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: ResultRow[]; total?: number }>(
        "/api/calibration/results-update"
      );
      const items = res.data?.items ?? [];
      setRows(
        items.map((r) => ({
          toolOrGaugeNo: r.toolOrGaugeNo || "—",
          name: r.name || r.toolOrGaugeNo || "—",
          type: r.type || "—",
          dcNo: r.dcNo || "—",
          cDate: r.cDate,
          nextCDate: r.nextCDate,
          frequency: r.frequency ?? "—",
          status: r.status || "—",
          remarks: r.remarks || "",
        }))
      );
      setLoading(false);
    })();
  }, []);

  const pending = rows.filter((r) =>
    ["pending", "open", "issued", "await"].some((k) =>
      String(r.status).toLowerCase().includes(k)
    )
  ).length;
  const done = rows.filter((r) =>
    ["pass", "fail", "done", "closed", "calibrat"].some((k) =>
      String(r.status).toLowerCase().includes(k)
    )
  ).length;

  return (
    <HistoryCardListView
      title="Calibration Results"
      subtitle="Pending and completed calibration results for history-card tools"
      searchPlaceholder="Filter by tool no, DC, or status…"
      searchKeys={["toolOrGaugeNo", "name", "dcNo", "status", "type"]}
      emptyText="No calibration result rows found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.toolOrGaugeNo}-${r.dcNo}-${i}`}
      kpis={[
        {
          id: "cr-total",
          label: "Result Lines",
          value: rows.length,
          subtext: "Loaded for review",
          icon: ClipboardList,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Lines", type: "info" },
        },
        {
          id: "cr-pending",
          label: "Pending Update",
          value: pending,
          subtext: "Awaiting results entry",
          icon: Clock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Pending", type: "warning" },
        },
        {
          id: "cr-done",
          label: "Updated / Closed",
          value: done,
          subtext: "Results recorded",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Done", type: "success" },
        },
        {
          id: "cr-tools",
          label: "Distinct Tools",
          value: new Set(rows.map((r) => String(r.toolOrGaugeNo))).size,
          subtext: "Unique tool numbers",
          icon: AlertCircle,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Tools", type: "info" },
        },
      ]}
      columns={[
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "dcNo", label: "DC No", mono: true },
        { key: "cDate", label: "Calib Date", mono: true },
        { key: "nextCDate", label: "Next Due", mono: true },
        { key: "frequency", label: "Freq", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ResultsPageInner />
    </Suspense>
  );
}
