"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Package, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type PoLine = {
  itemCode?: string | null;
  qty?: number | string | null;
  price?: number | string | null;
  toolRefNo?: number | null;
  tool?: { toolOrGaugeNo?: string | null; name?: string | null } | null;
};

type PoRow = {
  poOrderNo: string;
  poDate?: string | null;
  supCode?: string | null;
  supplier?: { supName?: string | null } | null;
  orderStatusCd?: number | null;
  lineCount?: number;
  toolLineCount?: number;
  lines?: PoLine[];
};

function PoPageInner() {
  const searchParams = useSearchParams();
  const toolFilter = (searchParams.get("tool") ?? "").trim();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerCount, setHeaderCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = new URLSearchParams({
        toolsOnly: "1",
        pageSize: "100",
        page: "1",
      });
      if (toolFilter) params.set("search", toolFilter);
      const res = await apiGet<{ items: PoRow[]; total?: number }>(`/api/po?${params}`);
      const headers = res.data?.items ?? [];
      setHeaderCount(res.data?.total ?? headers.length);

      const flat: Record<string, unknown>[] = [];
      for (const h of headers) {
        const lines = h.lines?.length ? h.lines : [null];
        for (const line of lines) {
          // When filtering by tool, keep only matching lines
          const lineTool =
            line?.tool?.toolOrGaugeNo || line?.itemCode || "";
          if (
            toolFilter &&
            line &&
            !lineTool.toUpperCase().includes(toolFilter.toUpperCase()) &&
            String(line.toolRefNo ?? "") !== toolFilter
          ) {
            continue;
          }
          flat.push({
            poOrderNo: h.poOrderNo || "—",
            poDate: h.poDate,
            supCode: h.supCode || "—",
            supplier: h.supplier?.supName || h.supCode || "—",
            toolOrGaugeNo: lineTool || "—",
            toolName: line?.tool?.name || line?.itemCode || "—",
            qty: line?.qty ?? "—",
            price: line?.price ?? "—",
            status: h.orderStatusCd != null ? String(h.orderStatusCd) : "—",
          });
        }
      }
      setRows(flat);
      setLoading(false);
    })();
  }, [toolFilter]);

  return (
    <HistoryCardListView
      title="Purchase Orders"
      subtitle="COMMON_PURCHASE_ORDER — tools-linked PO lines from shared ERP Purchasing"
      searchPlaceholder="Filter by PO, supplier, or tool no…"
      searchKeys={["poOrderNo", "supCode", "supplier", "toolOrGaugeNo", "toolName", "status"]}
      emptyText="No tools-linked purchase orders found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.poOrderNo}-${r.toolOrGaugeNo}-${i}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/tools-history-card/grn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            GRN History
          </Link>
          <Link
            href="/dashboard/po-linked/receive"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            PO-linked Receive <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      }
      kpis={[
        {
          id: "po-headers",
          label: "PO Headers",
          value: headerCount,
          subtext: "Tools-linked purchase orders",
          icon: FileText,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "PO", type: "info" },
        },
        {
          id: "po-lines",
          label: "PO Lines",
          value: rows.length,
          subtext: "Lines on this page",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Lines", type: "info" },
        },
        {
          id: "po-open",
          label: "With qty",
          value: rows.filter((r) => Number(r.qty) > 0).length,
          subtext: "Lines with order qty",
          icon: Clock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Qty", type: "warning" },
        },
        {
          id: "po-priced",
          label: "Priced",
          value: rows.filter((r) => Number(r.price) > 0).length,
          subtext: "Lines with unit price",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Price", type: "success" },
        },
      ]}
      columns={[
        { key: "poOrderNo", label: "PO No", mono: true },
        { key: "poDate", label: "PO Date", mono: true },
        { key: "supplier", label: "Supplier" },
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "qty", label: "Qty", mono: true },
        { key: "price", label: "Price", mono: true },
        { key: "status", label: "Status Cd", mono: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PoPageInner />
    </Suspense>
  );
}
