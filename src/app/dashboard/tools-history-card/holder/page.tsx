"use client";

import { Suspense, useEffect, useState } from "react";
import { Users, ArrowUpRight, Clock, Package } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type IssueLine = {
  toolOrGaugeNo?: string | null;
  name?: string | null;
  issueQty?: number | string | null;
  issueEmpName?: string | null;
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

function HolderPageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDcs, setOpenDcs] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Open issue DCs (same source as Tool Receive pending list)
      const res = await apiGet<{ items: IssueHeader[]; total?: number }>(
        "/api/issue?pageSize=50"
      );
      const headers = (res.data?.items ?? []).filter((h) =>
        ["OPEN", "PARTIAL", "Active"].includes(h.status ?? "")
      );
      setOpenDcs(headers.length);

      const flat: Record<string, unknown>[] = [];
      for (const h of headers) {
        const lines = h.lines?.length ? h.lines : [null];
        for (const line of lines) {
          const toolNo =
            line?.toolOrGaugeNo ||
            line?.tool?.toolOrGaugeNo ||
            line?.toolByRef?.toolOrGaugeNo ||
            "—";
          const toolName =
            line?.name ||
            line?.tool?.name ||
            line?.toolByRef?.name ||
            "";
          flat.push({
            dcNo: h.dcNo,
            holder: h.receiveName || line?.issueEmpName || "—",
            toolOrGaugeNo: toolNo,
            toolName: toolName && toolName.toUpperCase() !== "N/A" ? toolName : toolNo,
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

  const overdue = rows.filter((r) => {
    const d = r.dueDate ? new Date(String(r.dueDate)) : null;
    return d && !Number.isNaN(d.getTime()) && d < new Date();
  }).length;

  return (
    <HistoryCardListView
      title="Current Holder"
      subtitle="Open issue DCs — who currently holds each tool line"
      searchPlaceholder="Filter by holder, DC, or tool no…"
      searchKeys={["holder", "dcNo", "toolOrGaugeNo", "toolName", "status"]}
      emptyText="No open issue holders found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.dcNo}-${r.toolOrGaugeNo}-${i}`}
      kpis={[
        {
          id: "h-dcs",
          label: "Open DCs (page)",
          value: openDcs,
          subtext: "Recent open issue vouchers",
          icon: ArrowUpRight,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Open", type: "info" },
        },
        {
          id: "h-lines",
          label: "Held Lines",
          value: rows.length,
          subtext: "Tool lines still out",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Lines", type: "info" },
        },
        {
          id: "h-overdue",
          label: "Overdue Lines",
          value: overdue,
          subtext: "Past return due date",
          icon: Clock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Due", type: "warning" },
        },
        {
          id: "h-holders",
          label: "Distinct Holders",
          value: new Set(rows.map((r) => String(r.holder))).size,
          subtext: "Unique receive names",
          icon: Users,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "People", type: "success" },
        },
      ]}
      columns={[
        { key: "dcNo", label: "DC No", mono: true },
        { key: "holder", label: "Holder" },
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "qty", label: "Qty", mono: true },
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
      <HolderPageInner />
    </Suspense>
  );
}
