"use client";

import { Suspense, useEffect, useState } from "react";
import { Gauge, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { apiGet } from "@/lib/apiClient";
import { PageLoader } from "@/components/PageLoader";

type ToolRow = {
  refNo: number;
  toolOrGaugeNo: string;
  name: string | null;
  grouping: string;
  qtyIn: number | string;
  qtyOut: number | string;
  totQty: number | string;
  location: string | null;
  computedStatus?: string | null;
  status?: string | null;
};

function StatusPageInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: ToolRow[]; total: number }>(
        "/api/tools?pageSize=100&historyCardOnly=1"
      );
      const items = res.data?.items ?? [];
      setTotal(res.data?.total ?? items.length);
      setRows(
        items.map((t) => ({
          toolOrGaugeNo: t.toolOrGaugeNo,
          name: !t.name || t.name.trim().toUpperCase() === "N/A" ? t.toolOrGaugeNo : t.name,
          grouping: t.grouping,
          location: t.location || "Tool Crib",
          qtyIn: t.qtyIn,
          qtyOut: t.qtyOut,
          totQty: t.totQty,
          status: t.computedStatus || t.status || "No Units",
        }))
      );
      setLoading(false);
    })();
  }, []);

  const available = rows.filter((r) => String(r.status).toLowerCase().includes("available")).length;
  const inCalib = rows.filter((r) => String(r.status).toLowerCase().includes("calibration")).length;
  const attention = rows.filter((r) => String(r.status).toLowerCase().includes("attention")).length;

  return (
    <HistoryCardListView
      title="Current Status"
      subtitle="Roll-up status from GAUGE_SERIAL_NO units for History Card = Yes tools"
      searchPlaceholder="Filter by tool no, name, group, status…"
      searchKeys={["toolOrGaugeNo", "name", "grouping", "status", "location"]}
      emptyText="No history-card tools found."
      loading={loading}
      rows={rows}
      rowKey={(r) => String(r.toolOrGaugeNo)}
      kpis={[
        {
          id: "st-total",
          label: "History Card Tools",
          value: total,
          subtext: "Full ERP count (page shows up to 100)",
          icon: Gauge,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "All", type: "info" },
        },
        {
          id: "st-avail",
          label: "Available (page)",
          value: available,
          subtext: "Roll-up Available",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "OK", type: "success" },
        },
        {
          id: "st-calib",
          label: "In Calibration (page)",
          value: inCalib,
          subtext: "Units out for calibration",
          icon: Layers,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Calib", type: "warning" },
        },
        {
          id: "st-attn",
          label: "Needs Attention (page)",
          value: attention,
          subtext: "Rejected / worn out units",
          icon: AlertCircle,
          iconBg: "bg-rose-50 dark:bg-rose-950/30",
          iconColor: "text-rose-600 dark:text-rose-400",
          badge: { label: "Alert", type: "warning" },
        },
      ]}
      columns={[
        { key: "toolOrGaugeNo", label: "Tool No", mono: true },
        { key: "name", label: "Name" },
        { key: "grouping", label: "Group" },
        { key: "location", label: "Location" },
        { key: "qtyIn", label: "Qty In", mono: true },
        { key: "qtyOut", label: "Qty Out", mono: true },
        { key: "status", label: "Roll-up Status", status: true },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <StatusPageInner />
    </Suspense>
  );
}
