"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, FileText, Clock, Package } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type IssueLine = {
  toolOrGaugeNo?: string | null;
  name?: string | null;
  issueQty?: number | string | null;
  tool?: { toolOrGaugeNo?: string | null; name?: string | null } | null;
  toolByRef?: { toolOrGaugeNo?: string | null; name?: string | null } | null;
};

type IssueHeader = {
  dcNo: string;
  receiveName?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  lines?: IssueLine[];
};

function IssuePageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerCount, setHeaderCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: IssueHeader[]; total?: number }>(
        "/api/issue?pageSize=50"
      );
      const headers = res.data?.items ?? [];
      setHeaderCount(res.data?.total ?? headers.length);

      const flat: Record<string, unknown>[] = [];
      for (const h of headers) {
        const lines = h.lines?.length ? h.lines : [null];
        for (const line of lines) {
          const toolNo =
            line?.toolOrGaugeNo ||
            line?.tool?.toolOrGaugeNo ||
            line?.toolByRef?.toolOrGaugeNo ||
            "—";
          flat.push({
            dcNo: h.dcNo,
            receiveName: h.receiveName || "—",
            toolOrGaugeNo: toolNo,
            toolName: line?.name || line?.tool?.name || line?.toolByRef?.name || toolNo,
            qty: line?.issueQty ?? "—",
            issueDate: h.issueDate,
            dueDate: h.dueDate,
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
      title="Issue History"
      subtitle="GAUGE_TOOLS_ISSUE / TOOLS_TRANS_ISSUE — recent tool issue movements"
      searchPlaceholder="Filter by DC, receive name, or tool no…"
      searchKeys={["dcNo", "receiveName", "toolOrGaugeNo", "toolName", "status"]}
      emptyText="No issue history found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.dcNo}-${r.toolOrGaugeNo}-${i}`}
      kpis={[
        {
          id: "i-headers",
          label: "Issue DCs",
          value: headerCount,
          subtext: "Matching issue vouchers",
          icon: FileText,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "DC", type: "info" },
        },
        {
          id: "i-lines",
          label: "Issue Lines",
          value: rows.length,
          subtext: "Lines on this page",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Lines", type: "info" },
        },
        {
          id: "i-open",
          label: "Open / Active",
          value: rows.filter((r) =>
            ["open", "active", "partial"].includes(String(r.status).toLowerCase())
          ).length,
          subtext: "Still pending return",
          icon: ArrowUpRight,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Open", type: "warning" },
        },
        {
          id: "i-closed",
          label: "Closed Lines",
          value: rows.filter((r) =>
            String(r.status).toLowerCase().includes("closed")
          ).length,
          subtext: "Returned / closed",
          icon: Clock,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Done", type: "success" },
        },
      ]}
      columns={[
        { key: "dcNo", label: "DC No", mono: true },
        { key: "receiveName", label: "Receive Name" },
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "qty", label: "Qty", mono: true },
        { key: "issueDate", label: "Issue Date", mono: true },
        { key: "dueDate", label: "Due Date", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <IssuePageInner />
    </Suspense>
  );
}
