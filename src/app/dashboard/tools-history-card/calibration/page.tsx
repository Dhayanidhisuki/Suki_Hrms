"use client";

import { Suspense, useEffect, useState } from "react";
import { CalendarClock, FileText, Package, Clock } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type CalibLine = {
  toolOrGaugeNo?: string | null;
  name?: string | null;
  issueQty?: number | string | null;
  tool?: { name?: string | null } | null;
};

type CalibHeader = {
  dcNo: string;
  receiveName?: string | null;
  issueFor?: string | null;
  issueDate?: string | null;
  status?: string | null;
  inHouseLines?: CalibLine[];
  lines?: CalibLine[];
};

function CalibrationPageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: CalibHeader[]; total?: number }>(
        "/api/calibration/issue"
      );
      const headers = res.data?.items ?? [];
      setTotal(res.data?.total ?? headers.length);

      const flat: Record<string, unknown>[] = [];
      for (const h of headers) {
        const lines = (h.inHouseLines?.length ? h.inHouseLines : h.lines) ?? [];
        const useLines = lines.length ? lines : [null];
        for (const line of useLines) {
          flat.push({
            dcNo: h.dcNo,
            receiveName: h.receiveName || "—",
            issueFor: h.issueFor || "—",
            toolOrGaugeNo: line?.toolOrGaugeNo || "—",
            toolName: line?.name || line?.tool?.name || line?.toolOrGaugeNo || "—",
            qty: line?.issueQty ?? "—",
            issueDate: h.issueDate,
            status: h.status,
          });
        }
      }
      setRows(flat);
      setLoading(false);
    })();
  }, []);

  return (
    <HistoryCardListView
      title="Calibration Records"
      subtitle="TOOLS_ISSUE_FOR_CALIBRATION — calibration issue DCs and tool lines"
      searchPlaceholder="Filter by DC, vendor, or tool no…"
      searchKeys={["dcNo", "receiveName", "issueFor", "toolOrGaugeNo", "toolName", "status"]}
      emptyText="No calibration issue records found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.dcNo}-${r.toolOrGaugeNo}-${i}`}
      kpis={[
        {
          id: "c-dcs",
          label: "Calib Issue DCs",
          value: total,
          subtext: "Matching calibration vouchers",
          icon: CalendarClock,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Calib", type: "info" },
        },
        {
          id: "c-lines",
          label: "Tool Lines",
          value: rows.length,
          subtext: "Lines on this page",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Lines", type: "info" },
        },
        {
          id: "c-open",
          label: "Open / Active",
          value: rows.filter((r) =>
            ["open", "active", "issued"].some((k) =>
              String(r.status).toLowerCase().includes(k)
            )
          ).length,
          subtext: "Awaiting receive / results",
          icon: Clock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Open", type: "warning" },
        },
        {
          id: "c-vendors",
          label: "Issue For",
          value: new Set(rows.map((r) => String(r.issueFor))).size,
          subtext: "Distinct issue-for values",
          icon: FileText,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Dest", type: "success" },
        },
      ]}
      columns={[
        { key: "dcNo", label: "DC No", mono: true },
        { key: "receiveName", label: "Receive Name" },
        { key: "issueFor", label: "Issue For" },
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "qty", label: "Qty", mono: true },
        { key: "issueDate", label: "Issue Date", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CalibrationPageInner />
    </Suspense>
  );
}
