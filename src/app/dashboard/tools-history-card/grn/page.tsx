"use client";

import { Suspense, useEffect, useState } from "react";
import { Package, FileText, CheckCircle2, Clock } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type GrnLine = {
  itemCode?: string | null;
  recQty?: number | string | null;
  qtyOrder?: number | string | null;
  tool?: { toolOrGaugeNo?: string | null; name?: string | null } | null;
};

type GrnRow = {
  girNo?: number | string | null;
  girNoNew?: string | null;
  poOrderNo?: string | null;
  supCode?: string | null;
  girDate?: string | null;
  girStatus?: string | null;
  lines?: GrnLine[];
};

function GrnPageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerCount, setHeaderCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: GrnRow[]; total?: number }>("/api/po/grn");
      const headers = (res.data?.items ?? []).slice(0, 50);
      setHeaderCount(res.data?.items?.length ?? headers.length);

      const flat: Record<string, unknown>[] = [];
      for (const h of headers) {
        const lines = h.lines?.length ? h.lines : [null];
        for (const line of lines) {
          const toolNo = line?.tool?.toolOrGaugeNo || line?.itemCode || "—";
          flat.push({
            girNo: h.girNoNew || h.girNo || "—",
            poOrderNo: h.poOrderNo || "—",
            supCode: h.supCode || "—",
            toolOrGaugeNo: toolNo,
            toolName: line?.tool?.name || line?.itemCode || toolNo,
            qty: line?.recQty ?? line?.qtyOrder ?? "—",
            girDate: h.girDate,
            status: h.girStatus || "—",
          });
        }
      }
      setRows(flat);
      setLoading(false);
    })();
  }, []);

  return (
    <HistoryCardListView
      title="GRN History"
      subtitle="TOOLS_PO_RECEIVE — goods receipt history linked to tools purchasing"
      searchPlaceholder="Filter by GIR, PO, supplier, or tool no…"
      searchKeys={["girNo", "poOrderNo", "supCode", "toolOrGaugeNo", "toolName", "status"]}
      emptyText="No GRN history found."
      loading={loading}
      rows={rows}
      rowKey={(r, i) => `${r.girNo}-${r.toolOrGaugeNo}-${i}`}
      kpis={[
        {
          id: "g-headers",
          label: "GRN Vouchers",
          value: headerCount,
          subtext: "PO receive headers",
          icon: FileText,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "GRN", type: "info" },
        },
        {
          id: "g-lines",
          label: "GRN Lines",
          value: rows.length,
          subtext: "Lines on this page",
          icon: Package,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "Lines", type: "info" },
        },
        {
          id: "g-open",
          label: "Open / Active",
          value: rows.filter((r) =>
            ["open", "active", "partial"].some((k) =>
              String(r.status).toLowerCase().includes(k)
            )
          ).length,
          subtext: "In-progress receipts",
          icon: Clock,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Open", type: "warning" },
        },
        {
          id: "g-closed",
          label: "Closed / Posted",
          value: rows.filter((r) =>
            ["close", "post", "complete", "done"].some((k) =>
              String(r.status).toLowerCase().includes(k)
            )
          ).length,
          subtext: "Completed receipts",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Done", type: "success" },
        },
      ]}
      columns={[
        { key: "girNo", label: "GIR No", mono: true },
        { key: "poOrderNo", label: "PO No", mono: true },
        { key: "supCode", label: "Supplier", mono: true },
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "toolName", label: "Tool Name" },
        { key: "qty", label: "Qty", mono: true },
        { key: "girDate", label: "GRN Date", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <GrnPageInner />
    </Suspense>
  );
}
