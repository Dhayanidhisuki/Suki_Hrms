"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";

type PoRow = {
  poOrderNo: string;
  poDate: string | null;
  statusLabel: string;
  paymentStatus?: string | null;
  supCode: string | null;
  supplier?: { supName: string | null } | null;
  lineCount: number;
  toolLineCount: number;
  amount: number;
  currency: string;
  lines?: Array<{
    expLedgerCode?: string | null;
    budgetCode?: string | null;
  }>;
};

function dateKey(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.includes("T") ? iso.split("T")[0]! : iso.slice(0, 10);
}

export default function PurchaseOrderReportPage() {
  const [items, setItems] = useState<PoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      toolsOnly: "1",
    });
    if (search.trim()) params.set("search", search.trim());
    const res = await apiGet<{ items: PoRow[]; total: number }>(`/api/po?${params}`);
    setItems(res.data?.items ?? []);
    setTotal(res.data?.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SimpleMasterShell
      title="Purchase Order Report"
      subtitle="COMMON_PURCHASE_ORDER — Tools + ERP purchase orders (tools lines)"
      actions={
        <Link href="/dashboard/po-linked/purchase-order" className="inline-flex items-center justify-center rounded-xl border border-[var(--border-main)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]">
          Open PO list
        </Link>
      }
    >
      <MasterTableCard
        toolbar={
          <>
            <MasterSearchInput
              id="po-report-search"
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="PO no, supplier…"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
            <span className="text-[11px] text-[var(--text-muted)] ml-auto">
              {total.toLocaleString("en-IN")} POs
            </span>
          </>
        }
      >
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {[
                    "PO No",
                    "Date",
                    "Supplier",
                    "Lines",
                    "Amount",
                    "Payment",
                    "Ledger / Budget",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {items.map((po) => {
                  const ledgers = [
                    ...new Set(
                      (po.lines ?? [])
                        .map((l) => l.expLedgerCode?.trim())
                        .filter(Boolean) as string[]
                    ),
                  ];
                  const budgets = [
                    ...new Set(
                      (po.lines ?? [])
                        .map((l) => l.budgetCode?.trim())
                        .filter(Boolean) as string[]
                    ),
                  ];
                  return (
                  <tr key={po.poOrderNo} className="hover:bg-[var(--bg-hover)]">
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold">
                      <Link
                        href={`/dashboard/po-linked/purchase-order?search=${encodeURIComponent(po.poOrderNo)}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {po.poOrderNo}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">{dateKey(po.poDate)}</td>
                    <td className="py-2.5 px-3 text-sm">
                      {po.supCode}
                      {po.supplier?.supName ? ` · ${po.supplier.supName}` : ""}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {po.lineCount}
                      {po.toolLineCount > 0 ? (
                        <span className="text-[var(--text-muted)]"> · {po.toolLineCount} tool</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold">
                      ₹{Number(po.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 px-3">
                      {po.paymentStatus ? (
                        <StatusBadge status={po.paymentStatus} />
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)] max-w-[180px]">
                      {ledgers.length || budgets.length
                        ? [
                            ledgers.length ? `L: ${ledgers.join(", ")}` : null,
                            budgets.length ? `B: ${budgets.join(", ")}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={po.statusLabel} />
                    </td>
                  </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-[var(--text-muted)]">
                      No purchase orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>
    </SimpleMasterShell>
  );
}
