"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowDownLeft, CheckCircle2, FileText, Package } from "lucide-react";
import { HistoryCardListView } from "@/components/HistoryCardListView";
import { PageLoader } from "@/components/PageLoader";
import { apiGet } from "@/lib/apiClient";

type ReceiveRow = {
  recNo: number;
  receiveDate?: string | null;
  dcNo?: string | null;
  receivedFrom?: string | null;
  receivedBy?: string | null;
  vendorType?: string | null;
  location?: string | null;
  status?: string | null;
  toolOrGaugeNo?: string | null;
  serialNo?: number | null;
  description?: string | null;
  qty?: number | null;
};

function ReceiveHistoryInner() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiGet<{ items: ReceiveRow[]; total?: number }>("/api/receive?history=1&pageSize=100");
      const items = res.data?.items ?? [];
      setTotal(res.data?.total ?? items.length);
      setRows(items.map((row) => ({
        recNo: row.recNo,
        dcNo: row.dcNo || "—",
        toolOrGaugeNo: row.toolOrGaugeNo || "—",
        description: row.description || row.toolOrGaugeNo || "—",
        serialNo: row.serialNo ?? "—",
        receivedFrom: row.receivedFrom || "—",
        receivedBy: row.receivedBy || "—",
        receiveDate: row.receiveDate,
        location: row.location || "—",
        qty: row.qty ?? "—",
        status: row.status || "Received",
      })));
      setLoading(false);
    })();
  }, []);

  const completed = rows.filter((row) => ["received", "closed", "complete", "completed"].some((value) => String(row.status).toLowerCase().includes(value))).length;

  return (
    <HistoryCardListView
      title="Receive History"
      subtitle="Read-only tool return history with receipt status distribution and movement details"
      rows={rows}
      loading={loading}
      searchKeys={["recNo", "dcNo", "toolOrGaugeNo", "description", "receivedFrom", "receivedBy", "status"]}
      searchPlaceholder="Filter by receipt, DC, tool, party, receiver, or status…"
      emptyText="No tool receive history found."
      rowKey={(row, index) => `${row.recNo}-${row.toolOrGaugeNo}-${index}`}
      kpis={[
        { id: "rh-total", label: "Receive Vouchers", value: total, subtext: "Return receipts", icon: FileText, iconBg: "bg-[var(--primary-light)]", iconColor: "text-[var(--primary)]" },
        { id: "rh-lines", label: "Tool Lines", value: rows.length, subtext: "Visible received lines", icon: Package, iconBg: "bg-blue-50 dark:bg-blue-950/30", iconColor: "text-blue-600 dark:text-blue-400" },
        { id: "rh-qty", label: "Received Qty", value: rows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0), subtext: "Quantity represented", icon: ArrowDownLeft, iconBg: "bg-violet-50 dark:bg-violet-950/30", iconColor: "text-violet-600 dark:text-violet-400" },
        { id: "rh-done", label: "Completed", value: completed, subtext: "Completed receipt lines", icon: CheckCircle2, iconBg: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
      ]}
      columns={[
        { key: "recNo", label: "Receipt", mono: true },
        { key: "dcNo", label: "Issue DC", mono: true },
        { key: "toolOrGaugeNo", label: "Tool / Gauge", mono: true },
        { key: "description", label: "Description" },
        { key: "serialNo", label: "Serial", mono: true },
        { key: "receivedFrom", label: "Received From" },
        { key: "receivedBy", label: "Received By" },
        { key: "receiveDate", label: "Receive Date", mono: true },
        { key: "location", label: "Location" },
        { key: "qty", label: "Qty", mono: true },
        { key: "status", label: "Status", status: true },
      ]}
    />
  );
}

export default function ReceiveHistoryPage() {
  return <Suspense fallback={<PageLoader />}><ReceiveHistoryInner /></Suspense>;
}
