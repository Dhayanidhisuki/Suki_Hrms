"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, CheckCircle2, FileText } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { PageLoader } from "@/components/PageLoader";
import { apiGet } from "@/lib/apiClient";

type IssueLine = {
  rowId?: number;
  toolOrGaugeNo?: string | null;
  issueQty?: number | string | null;
  serialNo?: number | null;
  tool?: { toolOrGaugeNo?: string | null; name?: string | null } | null;
  toolByRef?: { toolOrGaugeNo?: string | null; name?: string | null } | null;
};

type IssueHeader = {
  dcNo: string;
  receiveName?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  issueOption?: string | null;
  fromUnit?: string | null;
  status?: string | null;
  lines?: IssueLine[];
};

function IssueHistoryInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiGet<{ items: IssueHeader[]; total?: number }>("/api/issue?pageSize=50");
      const headers = res.data?.items ?? [];
      setTotal(res.data?.total ?? headers.length);
      setRows(headers.flatMap((header) => {
        const lines = header.lines?.length ? header.lines : [null];
        return lines.map((line) => {
          const tool = line?.tool ?? line?.toolByRef;
          return {
            dcNo: header.dcNo,
            toolOrGaugeNo: line?.toolOrGaugeNo || tool?.toolOrGaugeNo || "—",
            toolName: tool?.name || line?.toolOrGaugeNo || "—",
            serialNo: line?.serialNo ?? "—",
            holder: header.receiveName || "—",
            issueType: header.issueOption || "—",
            issueDate: header.issueDate,
            dueDate: header.dueDate,
            qty: line?.issueQty ?? "—",
            status: header.status || "—",
          };
        });
      }));
      setLoading(false);
    })();
  }, []);

  const open = rows.filter((row) => ["active", "open", "partial"].includes(String(row.status).toLowerCase())).length;
  const closed = rows.filter((row) => ["closed", "cancelled"].includes(String(row.status).toLowerCase())).length;

  return (
    <HistoryCardListView
      title="Issue History"
      subtitle="Read-only issue movement history with status distribution and holder details"
      rows={rows}
      loading={loading}
      searchKeys={["dcNo", "toolOrGaugeNo", "toolName", "holder", "issueType", "status"]}
      searchPlaceholder="Filter by DC, tool, holder, issue type, or status…"
      emptyText="No tool issue history found."
      rowKey={(row, index) => `${row.dcNo}-${row.toolOrGaugeNo}-${index}`}
      kpis={[
        { id: "ih-dc", label: "Issue DCs", value: total, subtext: "Issue vouchers", icon: FileText, iconBg: "bg-[var(--primary-light)]", iconColor: "text-[var(--primary)]" },
        { id: "ih-lines", label: "Tool Lines", value: rows.length, subtext: "Visible issue lines", icon: ArrowUpRight, iconBg: "bg-blue-50 dark:bg-blue-950/30", iconColor: "text-blue-600 dark:text-blue-400" },
        { id: "ih-open", label: "Open / Active", value: open, subtext: "Currently issued", icon: AlertCircle, iconBg: "bg-amber-50 dark:bg-amber-950/30", iconColor: "text-amber-600 dark:text-amber-400" },
        { id: "ih-closed", label: "Closed", value: closed, subtext: "Completed movements", icon: CheckCircle2, iconBg: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
      ]}
      columns={[
        { key: "dcNo", label: "DC No", mono: true },
        { key: "toolOrGaugeNo", label: "Tool / Gauge", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "serialNo", label: "Serial", mono: true },
        { key: "holder", label: "Issued To" },
        { key: "issueType", label: "Issue Type" },
        { key: "issueDate", label: "Issue Date", mono: true },
        { key: "dueDate", label: "Due Date", mono: true },
        { key: "qty", label: "Qty", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function IssueHistoryPage() {
  return <Suspense fallback={<PageLoader />}><IssueHistoryInner /></Suspense>;
}
