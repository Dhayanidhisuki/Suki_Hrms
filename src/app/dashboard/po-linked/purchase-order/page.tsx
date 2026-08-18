"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Package,
  CircleDot,
  Wrench,
  ArrowRight,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPut } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useSession } from "@/lib/SessionContext";
import { toastError, toastSuccess } from "@/lib/appToast";
import { MasterSearchSelect } from "@/components/ui/MasterSearchSelect";

interface PoLine {
  rowId: number;
  itemCode: string | null;
  itemName: string | null;
  itemDesc: string | null;
  itemType: string | null;
  qty: number | null;
  price: number | null;
  uom: string | null;
  toolRefNo: number | null;
  tool?: { refNo: number; toolOrGaugeNo: string | null; name: string | null } | null;
  expLedgerCode?: string | null;
  budgetCode?: string | null;
}

interface PurchaseOrder {
  poOrderNo: string;
  poDate: string | null;
  validTill: string | null;
  orderStatusCd: number | null;
  statusLabel: string;
  supCode: string | null;
  supplier?: { supCode: string; supName: string | null } | null;
  purchaseType: string | null;
  currency: string;
  lobType: string | null;
  lineCount: number;
  toolLineCount: number;
  amount: number;
  paymentStatus?: string | null;
  paymentDate?: string | null;
  lines: PoLine[];
}

interface SupplierOpt {
  supCode: string;
  supName: string | null;
}

function dateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.includes("T") ? iso.split("T")[0]! : iso.slice(0, 10);
}

function formatInr(n: number, currency = "INR"): string {
  if (currency && currency !== "INR") {
    return `${currency} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function supplierLabel(po: PurchaseOrder): string {
  const name = po.supplier?.supName?.trim();
  const code = po.supCode ?? po.supplier?.supCode;
  if (name && code) return `${code} · ${name}`;
  if (name) return name;
  if (code) return code;
  return "—";
}

export default function PurchaseOrderPage() {
  const { can } = useSession();
  const canCreate = can("canCreatePO");
  const canUpdateFinance = can("canUpdateFinance");
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [supFilter, setSupFilter] = useState("ALL");
  const [toolsOnly, setToolsOnly] = useState(true);
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [payingPo, setPayingPo] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("search");
      if (q?.trim()) setSearchQuery(q.trim());
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(
    async (p = page, q = searchQuery) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
      });
      if (q.trim()) params.set("search", q.trim());
      if (supFilter !== "ALL") params.set("supCode", supFilter);
      if (toolsOnly) params.set("toolsOnly", "1");

      const res = await apiGet<{
        items: PurchaseOrder[];
        total: number;
        error?: string;
      }>(`/api/po?${params}`);

      if (res.error) {
        setError(typeof res.error.message === "string" ? res.error.message : "Failed to load POs");
        setItems([]);
        setTotal(0);
      } else {
        setItems(res.data?.items ?? []);
        setTotal(res.data?.total ?? 0);
      }
      setLoading(false);
    },
    [page, searchQuery, supFilter, toolsOnly]
  );

  useEffect(() => {
    void load(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(page, searchQuery);
  }, [page, toolsOnly, supFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const openish = items.filter((p) =>
      /open|draft|partial|approved|status 1|status 2|status 5/i.test(p.statusLabel)
    ).length;
    const withTools = items.filter((p) => p.toolLineCount > 0).length;
    const amountSum = items.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    return [
      {
        id: "po-total",
        label: "Matching POs",
        value: total,
        subtext: `Page ${page} · ${items.length} shown`,
        title: "COMMON_PURCHASE_ORDER rows matching filters",
        icon: FileText,
        iconBg: "bg-[var(--primary-light)]",
        iconColor: "text-[var(--primary)]",
        badge: { label: canCreate ? "Writable" : "Read-only", type: "info" as const },
      },
      {
        id: "po-page-open",
        label: "Open-ish (page)",
        value: openish,
        subtext: "Draft / Open / Partial / Approved",
        icon: CircleDot,
        iconBg: "bg-blue-50 dark:bg-blue-950/40",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      {
        id: "po-tools",
        label: "With tool lines (page)",
        value: withTools,
        subtext: "TOOL_REF_NO present",
        icon: Wrench,
        iconBg: "bg-amber-50 dark:bg-amber-950/40",
        iconColor: "text-amber-600 dark:text-amber-400",
      },
      {
        id: "po-amount",
        label: "Amount (page)",
        value: Math.round(amountSum),
        subtext: formatInr(amountSum),
        title: "Sum of PURCHASE_VALUE or line qty×price on this page",
        icon: Package,
        iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      },
    ];
  }, [items, total, page, canCreate]);

  const updatePayment = useCallback(
    async (poOrderNo: string, paymentStatus: "UNPAID" | "PARTIAL" | "PAID") => {
      setPayingPo(poOrderNo);
      const res = await apiPut<{
        ok?: boolean;
        finance?: { paymentStatus: string; paymentDate: string | null };
      }>(`/api/po/${encodeURIComponent(poOrderNo)}/finance`, { paymentStatus });
      setPayingPo(null);
      if (res.error) {
        toastError(res.error.message);
        return;
      }
      toastSuccess(`Payment → ${paymentStatus}`);
      setItems((prev) =>
        prev.map((p) =>
          p.poOrderNo === poOrderNo
            ? {
                ...p,
                paymentStatus: res.data?.finance?.paymentStatus ?? paymentStatus,
                paymentDate: res.data?.finance?.paymentDate ?? p.paymentDate,
              }
            : p
        )
      );
    },
    []
  );

  const columns: DataTableColumn<PurchaseOrder>[] = useMemo(
    () => [
      {
        id: "poOrderNo",
        header: "PO no",
        mono: true,
        cell: (po) => (
          <span className="font-semibold text-[var(--text-primary)]">{po.poOrderNo}</span>
        ),
      },
      {
        id: "poDate",
        header: "PO date",
        mono: true,
        cell: (po) => dateKey(po.poDate) || "—",
      },
      {
        id: "supplier",
        header: "Supplier",
        cell: (po) => (
          <span className="text-[var(--text-primary)] font-medium">{supplierLabel(po)}</span>
        ),
      },
      {
        id: "lines",
        header: "Lines",
        mono: true,
        cell: (po) => (
          <span className="font-semibold">
            {po.lineCount}
            {po.toolLineCount > 0 ? (
              <span className="text-[var(--text-muted)] font-normal"> · {po.toolLineCount} tool</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        mono: true,
        cell: (po) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {formatInr(Number(po.amount) || 0, po.currency)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (po) => <StatusBadge status={po.statusLabel} />,
      },
      {
        id: "payment",
        header: "Payment",
        cell: (po) =>
          po.paymentStatus ? (
            <StatusBadge status={po.paymentStatus} />
          ) : (
            <span className="text-[var(--text-muted)] text-xs">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: (po) => (
          <Link
            href={`/dashboard/po-linked/receive?po=${encodeURIComponent(po.poOrderNo)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
          >
            Receive <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ),
      },
    ],
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Purchase Order
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Shared{" "}
                <span className="font-mono text-xs">COMMON_PURCHASE_ORDER</span>
                {" · "}
                Tools create uses the same ERP numbering / tables
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canCreate ? (
                <Link href="/dashboard/po-linked/purchase-order/create">
                  <Button type="button" variant="primary">
                    Create PO
                  </Button>
                </Link>
              ) : null}
              <Link href="/dashboard/po-linked/receive">
                <Button type="button" variant={canCreate ? "outline" : "primary"}>
                  Goods Receipt Note
                </Button>
              </Link>
            </div>
          </div>

          <ModuleKpiRow items={kpis} />

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="form-label">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPage(1);
                        void load(1, searchQuery);
                      }
                    }}
                    placeholder="PO no, supplier, remarks…"
                    className="form-control form-control-icon"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <MasterSearchSelect
                  kind="supplier"
                  label="Supplier"
                  value={supFilter === "ALL" ? "" : supFilter}
                  selectedLabel={supFilter}
                  onChange={(value) => {
                    setSupFilter(value || "ALL");
                    setPage(1);
                  }}
                  placeholder="All suppliers — search to filter…"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] pb-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={toolsOnly}
                  onChange={(e) => {
                    setToolsOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 rounded border-[var(--border-main)]"
                />
                Tools lines only
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPage(1);
                  void load(1, searchQuery);
                }}
              >
                Apply
              </Button>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-danger-text)] bg-[var(--color-danger-bg)] rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <DataTable
              columns={columns}
              rows={items}
              rowKey={(po) => po.poOrderNo}
              loading={loading}
              emptyText="No purchase orders found."
              expandedKey={expandedPo}
              onToggleExpand={(po) =>
                setExpandedPo((cur) => (cur === po.poOrderNo ? null : po.poOrderNo))
              }
              renderExpanded={(po) => (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)] items-center">
                    <span>
                      Valid till:{" "}
                      <span className="font-mono text-[var(--text-secondary)]">
                        {dateKey(po.validTill) || "—"}
                      </span>
                    </span>
                    <span>
                      Type:{" "}
                      <span className="text-[var(--text-secondary)]">{po.purchaseType || "—"}</span>
                    </span>
                    <span>
                      LOB:{" "}
                      <span className="text-[var(--text-secondary)]">{po.lobType || "—"}</span>
                    </span>
                    <span>
                      Payment:{" "}
                      <span className="text-[var(--text-secondary)]">
                        {po.paymentStatus || "—"}
                        {po.paymentDate ? ` · ${dateKey(po.paymentDate)}` : ""}
                      </span>
                    </span>
                    {canUpdateFinance ? (
                      <span className="flex flex-wrap gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
                        {(["UNPAID", "PARTIAL", "PAID"] as const).map((st) => (
                          <Button
                            key={st}
                            type="button"
                            size="sm"
                            variant={po.paymentStatus === st ? "primary" : "outline"}
                            disabled={payingPo === po.poOrderNo}
                            onClick={() => void updatePayment(po.poOrderNo, st)}
                          >
                            {st}
                          </Button>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["Item", "Description", "Qty", "UOM", "Price", "Ledger", "Budget", "Tool"].map(
                            (h) => (
                              <th
                                key={h}
                                className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3"
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {po.lines.map((line) => (
                          <tr key={line.rowId}>
                            <td className="py-2 px-3 font-mono text-xs font-semibold">
                              {line.itemCode || "—"}
                            </td>
                            <td className="py-2 px-3 text-xs max-w-xs truncate">
                              {line.itemName || line.itemDesc || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">{line.qty ?? "—"}</td>
                            <td className="py-2 px-3 text-xs">{line.uom || "—"}</td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {line.price != null ? formatInr(line.price, po.currency) : "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {line.expLedgerCode || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {line.budgetCode || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {line.tool?.toolOrGaugeNo ||
                                (line.toolRefNo != null ? `#${line.toolRefNo}` : "—")}
                            </td>
                          </tr>
                        ))}
                        {po.lines.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-xs text-[var(--text-muted)]">
                              No line items.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <Link href={`/dashboard/po-linked/receive?po=${encodeURIComponent(po.poOrderNo)}`}>
                      <Button type="button" size="sm" variant="primary">
                        Receive against this PO
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            />

            {total > pageSize && (
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)]">
                <p className="text-xs text-[var(--text-muted)]">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
