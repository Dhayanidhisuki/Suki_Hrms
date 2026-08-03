"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowDownLeft, FileText, Package, CheckCircle2 } from "lucide-react";
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

function ReceivePageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Pending returns live on open issue DCs (receive module source of truth)
      const res = await apiGet<{
        items: IssueHeader[];
        pendingTotal?: number;
        total?: number;
      }>("/api/receive?pageSize=50");
      const headers = res.data?.items ?? [];
      setPending(res.data?.pendingTotal ?? res.data?.total ?? headers.length);

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
      title="Receive History"
      subtitle="Open / pending returns awaiting Tool Receive — cross-check after returns are posted"
      searchPlaceholder="Filter by DC, name, or tool no…"
      searchKeys={["dcNo", "receiveName", "toolOrGaugeNo", "toolName", "status"]}
      emptyText="No pending receive records found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.dcNo}-${r.toolOrGaugeNo}-${i}`}
      kpis={[
        {
          id: "r-pending",
          label: "Pending Return DCs",
          value: pending,
          subtext: "Open in ERP total",
          icon: ArrowDownLeft,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Pending", type: "info" },
        },
        {
          id: "r-page",
          label: "DCs On Page",
          value: new Set(rows.map((r) => String(r.dcNo))).size,
          subtext: "Loaded for review",
          icon: FileText,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Page", type: "info" },
        },
        {
          id: "r-lines",
          label: "Open Lines",
          value: rows.length,
          subtext: "Lines awaiting return",
          icon: Package,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Lines", type: "warning" },
        },
        {
          id: "r-ready",
          label: "Ready To Receive",
          value: rows.filter((r) => r.toolOrGaugeNo && r.toolOrGaugeNo !== "—").length,
          subtext: "Lines with a tool number",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Linked", type: "success" },
        },
      ]}
      columns={[
        { key: "dcNo", label: "DC No", mono: true },
        { key: "receiveName", label: "Receive Name" },
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "qty", label: "Qty Out", mono: true },
        { key: "issueDate", label: "Issued", mono: true },
        { key: "dueDate", label: "Due", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReceivePageInner />
    </Suspense>
  );
}
