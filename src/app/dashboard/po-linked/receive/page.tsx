"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash,
  ShieldAlert,
  Package,
  CircleDot,
  CheckCircle2,
  Users,
  Search,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/appToast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

interface Supplier {
  supCode: string;
  supName: string;
  isApproved: boolean;
}

interface Tool {
  refNo: number;
  toolOrGaugeNo: string;
  name: string;
}

interface PoGrnLine {
  rowId: number;
  girNo: number;
  itemCode: string;
  invQty: number;
  recQty: number;
  price: number;
  tool?: { name: string; toolOrGaugeNo?: string } | null;
}

interface PoGrnHeader {
  girNo: number;
  girNoNew?: string | null;
  poOrderNo: string | null;
  girDate: string | null;
  girStatus: string | null;
  supCode?: string | null;
  supplier?: { supCode: string; supName: string | null } | null;
  lines: PoGrnLine[];
}

interface StagedGrnLine {
  toolOrGaugeNo: string;
  invQty: number;
  recQty: number;
  price: number;
}

function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.includes("T") ? iso.split("T")[0]! : iso.slice(0, 10);
}

function isSameMonth(iso: string | null | undefined, ref = new Date()): boolean {
  const key = dateKey(iso);
  if (!key) return false;
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/** ERP uses OPEN; app create uses Posted. Partial/Closed rare but supported. */
function isOpenStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "open" || s === "draft" || s.includes("partial");
}

function isClosedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "posted" || s.includes("closed") || s === "complete" || s === "completed";
}

function grnAmount(grn: PoGrnHeader): number {
  return (grn.lines ?? []).reduce(
    (sum, line) => sum + toNum(line.recQty) * toNum(line.price),
    0
  );
}

function supplierLabel(grn: PoGrnHeader): string {
  const name = grn.supplier?.supName?.trim();
  const code = grn.supCode ?? grn.supplier?.supCode;
  if (name && code) return `${code} · ${name}`;
  if (name) return name;
  if (code) return code;
  return "—";
}

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PoReceivePage() {
  const searchParams = useSearchParams();
  const [grns, setGrns] = useState<PoGrnHeader[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [expandedGrn, setExpandedGrn] = useState<number | null>(null);

  const [poOrderNo, setPoOrderNo] = useState("");
  const [girDate, setGirDate] = useState("");
  const [supCode, setSupCode] = useState("");
  const [stagedLines, setStagedLines] = useState<StagedGrnLine[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // List filters (server-side via /api/po/grn)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setGirDate(new Date().toISOString().split("T")[0]);
  }, [showForm]);

  /** Prefill GRN form from ?po= (Receive link on PO list). */
  useEffect(() => {
    const po = searchParams.get("po")?.trim();
    if (!po) return;

    setPoOrderNo(po);
    setShowForm(true);
    setErrors({});

    let cancelled = false;
    void (async () => {
      const res = await apiGet<{
        items?: Array<{
          poOrderNo: string;
          supCode: string | null;
          lines: Array<{
            itemCode: string | null;
            qty: number | null;
            price: number | null;
            tool?: {
              refNo: number;
              toolOrGaugeNo: string | null;
              name: string | null;
            } | null;
          }>;
        }>;
      }>(
        `/api/po?search=${encodeURIComponent(po)}&pageSize=20&toolsOnly=0`
      );

      if (cancelled) return;

      const items = res.data?.items ?? [];
      const match =
        items.find((p) => p.poOrderNo.toUpperCase() === po.toUpperCase()) ??
        items[0];

      if (!match) {
        toastError(`PO ${po} not found — fill supplier and lines manually`);
        return;
      }

      if (match.supCode) setSupCode(match.supCode);

      const staged: StagedGrnLine[] = [];
      const extraTools: Tool[] = [];
      for (const l of match.lines ?? []) {
        const toolNo = (l.tool?.toolOrGaugeNo || l.itemCode || "").trim();
        if (!toolNo) continue;
        const qty = Number(l.qty);
        const price = Number(l.price);
        staged.push({
          toolOrGaugeNo: toolNo,
          invQty: Number.isFinite(qty) && qty > 0 ? qty : 1,
          recQty: Number.isFinite(qty) && qty > 0 ? qty : 1,
          price: Number.isFinite(price) && price >= 0 ? price : 0,
        });
        extraTools.push({
          refNo: l.tool?.refNo ?? -(extraTools.length + 1),
          toolOrGaugeNo: toolNo,
          name: l.tool?.name ?? toolNo,
        });
      }

      if (staged.length > 0) {
        setStagedLines(staged);
        setTools((prev) => {
          const byNo = new Map(prev.map((t) => [t.toolOrGaugeNo, t]));
          for (const t of extraTools) {
            if (!byNo.has(t.toolOrGaugeNo)) byNo.set(t.toolOrGaugeNo, t);
          }
          return Array.from(byNo.values());
        });
        toastSuccess(`Loaded ${staged.length} line(s) from ${match.poOrderNo}`);
      } else {
        toastError(`${match.poOrderNo} has no tool lines to receive`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (supplierFilter !== "ALL") params.set("supCode", supplierFilter);
    if (dateFrom) params.set("fromDate", dateFrom);
    if (dateTo) params.set("toDate", dateTo);

    const [gRes, sRes, tRes] = await Promise.all([
      apiGet<{
        items: PoGrnHeader[];
        total: number;
        totalPages?: number;
        page?: number;
        pageSize?: number;
      }>(`/api/po/grn?${params}`),
      apiGet<{ items: Supplier[] }>("/api/suppliers?pageSize=500"),
      apiGet<{ items: Tool[] }>("/api/tools?pageSize=100"),
    ]);

    if (gRes.data?.items) setGrns(gRes.data.items);
    else setGrns([]);
    setTotal(gRes.data?.total ?? 0);
    setTotalPages(
      gRes.data?.totalPages ??
        Math.max(1, Math.ceil((gRes.data?.total ?? 0) / pageSize))
    );
    if (sRes.data?.items) setSuppliers(sRes.data.items);
    if (tRes.data?.items) {
      setTools((prev) => {
        const byNo = new Map((tRes.data?.items ?? []).map((t) => [t.toolOrGaugeNo, t]));
        for (const t of prev) {
          if (!byNo.has(t.toolOrGaugeNo)) byNo.set(t.toolOrGaugeNo, t);
        }
        return Array.from(byNo.values());
      });
    }
    setLoading(false);
  }, [page, pageSize, searchQuery, statusFilter, supplierFilter, dateFrom, dateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>(["OPEN", "Posted", "CLOSED", "PARTIAL"]);
    for (const g of grns) {
      const s = (g.girStatus ?? "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [grns]);

  const supplierOptions = useMemo(() => {
    return suppliers
      .map((s) => ({
        code: s.supCode,
        label: s.supName ? `${s.supCode} · ${s.supName}` : s.supCode,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [suppliers]);

  // Server already filtered — keep list as returned
  const filteredGrns = grns;

  const kpis = useMemo(() => {
    const openCount = grns.filter((g) => isOpenStatus(g.girStatus)).length;
    const closedThisMonth = grns.filter(
      (g) => isClosedStatus(g.girStatus) && isSameMonth(g.girDate)
    ).length;
    const suppliersThisMonth = new Set(
      grns
        .filter((g) => isSameMonth(g.girDate))
        .map((g) => (g.supCode ?? g.supplier?.supCode ?? "").trim())
        .filter(Boolean)
    ).size;

    return [
      {
        id: "grn-total",
        label: "Matching GRNs",
        value: total,
        subtext: `Page ${page} of ${totalPages} · ${pageSize}/page`,
        title: "Total TOOLS_PO_RECEIVE rows matching filters (paginated)",
        icon: Package,
        iconBg: "bg-[var(--primary-light)]",
        iconColor: "text-[var(--primary)]",
      },
      {
        id: "grn-open",
        label: "Open (page)",
        value: openCount,
        subtext: "OPEN / Draft / Partial on this page",
        icon: CircleDot,
        iconBg: "bg-blue-50 dark:bg-blue-950/40",
        iconColor: "text-blue-600 dark:text-blue-400",
        badge: { label: "Open", type: "info" as const },
      },
      {
        id: "grn-closed-month",
        label: "Closed (page)",
        value: closedThisMonth,
        subtext: "Posted / Closed · current month",
        icon: CheckCircle2,
        iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        badge: { label: "Month", type: "success" as const },
      },
      {
        id: "grn-suppliers-month",
        label: "Suppliers (page)",
        value: suppliersThisMonth,
        subtext: "Distinct SUP_CODE this month",
        icon: Users,
        iconBg: "bg-violet-50 dark:bg-violet-950/40",
        iconColor: "text-violet-600 dark:text-violet-400",
      },
    ];
  }, [grns, total, page, totalPages, pageSize]);

  const columns: DataTableColumn<PoGrnHeader>[] = useMemo(
    () => [
      {
        id: "girNo",
        header: "GRN no",
        mono: true,
        cell: (g) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {g.girNo}
            {g.girNoNew ? (
              <span className="block text-[10px] font-normal text-[var(--text-muted)]">
                {g.girNoNew}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "poOrderNo",
        header: "PO no",
        mono: true,
        cell: (g) => g.poOrderNo || "—",
      },
      {
        id: "supplier",
        header: "Supplier",
        cell: (g) => (
          <span className="text-[var(--text-primary)] font-medium">{supplierLabel(g)}</span>
        ),
      },
      {
        id: "girDate",
        header: "Date",
        mono: true,
        cell: (g) => dateKey(g.girDate) || "—",
      },
      {
        id: "lines",
        header: "Lines",
        mono: true,
        cell: (g) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {(g.lines ?? []).length}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        mono: true,
        cell: (g) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {formatInr(grnAmount(g))}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (g) => <StatusBadge status={g.girStatus || "—"} />,
      },
    ],
    []
  );

  const handleAddLine = () => {
    if (tools.length === 0) return;
    const defaultTool = tools[0].toolOrGaugeNo;
    setStagedLines((prev) => [
      ...prev,
      { toolOrGaugeNo: defaultTool, invQty: 10, recQty: 10, price: 500 },
    ]);
  };

  const handleLineChange = (
    index: number,
    field: keyof StagedGrnLine,
    value: string | number
  ) => {
    const updated = [...stagedLines];
    updated[index] = { ...updated[index], [field]: value };
    setStagedLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setStagedLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearForm = () => {
    setPoOrderNo("");
    setSupCode("");
    setStagedLines([]);
    setErrors({});
  };

  const handlePostGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!poOrderNo.trim()) tempErrors.poOrderNo = "PO Order number is required";
    if (!supCode.trim()) tempErrors.supCode = "Supplier is required";
    if (stagedLines.length === 0) tempErrors.lines = "At least one GRN line item must be added";

    stagedLines.forEach((line, idx) => {
      if (line.recQty > line.invQty) {
        tempErrors[`qty-${idx}`] = `Received qty cannot exceed invoice qty (${line.invQty})`;
      }
      if (line.price <= 0) {
        tempErrors[`rate-${idx}`] = "Unit price must be greater than 0";
      }
    });

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      poOrderNo,
      supCode,
      girDate,
      lines: stagedLines.map((l) => ({
        itemCode: l.toolOrGaugeNo,
        invQty: l.invQty,
        recQty: l.recQty,
        price: l.price,
      })),
    };

    const res = await apiPost<{
      grn: PoGrnHeader & { girNoNew?: string | null };
    }>("/api/po/grn", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    if (res.data?.grn) {
      const g = res.data.grn;
      toastSuccess({
        title: "GRN posted",
        message: "Inventory stock increased. Search the tool in Item / Asset Master to see Tot Qty.",
        detail: `GRN #${g.girNo}${g.girNoNew ? ` (${g.girNoNew})` : ""} · ${poOrderNo}`,
      });
      handleClearForm();
      setShowForm(false);
      // Make the new GRN visible (list defaults / filters can hide it)
      setStatusFilter("ALL");
      setDateFrom("");
      setDateTo("");
      setSearchQuery(String(g.girNo));
      setPage(1);
      setExpandedGrn(g.girNo);
      // loadData re-runs via filter/page deps
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setSupplierFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                PO Receive (GRN)
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Goods receipt against purchase orders (TOOLS_PO_RECEIVE)
              </p>
            </div>
            <RoleGate permission="canRaisePO">
              {!showForm && (
                <Button
                  id="po-receive-add-btn"
                  onClick={() => setShowForm(true)}
                  variant="primary"
                  className="group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  New GRN
                </Button>
              )}
            </RoleGate>
          </div>

          {/* ── ACTIVE GRN FORM (TOP) — unchanged create flow ── */}
          {showForm && (
            <form onSubmit={handlePostGRN} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-5 mb-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
                    Active GRN Form
                  </h2>
                  {poOrderNo ? (
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Receiving against{" "}
                      <span className="font-mono font-semibold text-[var(--text-secondary)]">
                        {poOrderNo}
                      </span>
                      {supCode ? (
                        <>
                          {" "}
                          · supplier{" "}
                          <span className="font-mono font-semibold text-[var(--text-secondary)]">
                            {supCode}
                          </span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)] font-bold bg-[var(--bg-subtle)] px-2.5 py-1 rounded-md">
                  GRN No: Auto-generated
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">
                    PO Order Number *
                  </label>
                  <input
                    id="form-po-ref"
                    value={poOrderNo}
                    onChange={(e) => setPoOrderNo(e.target.value.toUpperCase())}
                    placeholder="e.g. PO-MEQ-2026-001"
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono font-semibold"
                  />
                  {errors.poOrderNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.poOrderNo}</p>}
                </div>

                <div>
                  <label className="form-label">
                    Supplier *
                  </label>
                  <select
                    id="form-supplier"
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                  >
                    <option value="">— Select Supplier —</option>
                    {suppliers.map((s) => (
                      <option key={s.supCode} value={s.supCode}>
                        {s.supCode} · {s.supName}
                      </option>
                    ))}
                  </select>
                  {errors.supCode && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.supCode}</p>}
                </div>

                <div>
                  <label className="form-label">
                    GRN Date
                  </label>
                  <input
                    type="date"
                    value={girDate}
                    onChange={(e) => setGirDate(e.target.value)}
                    className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-mono font-medium text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Receipt Line Items</p>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Add Item Line
                  </button>
                </div>

                {errors.lines && (
                  <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span>{errors.lines}</span>
                  </div>
                )}

                <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["Select Tool", "Inv Qty", "Received Qty", "Unit Price (₹)", ""].map((col) => (
                          <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {stagedLines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <select
                              value={line.toolOrGaugeNo}
                              onChange={(e) => handleLineChange(idx, "toolOrGaugeNo", e.target.value)}
                              className="w-full text-sm border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none"
                            >
                              {tools.map((t) => (
                                <option key={t.refNo} value={t.toolOrGaugeNo}>
                                  {t.toolOrGaugeNo} · {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={line.invQty}
                              onChange={(e) => handleLineChange(idx, "invQty", Number(e.target.value))}
                              className="w-24 text-center text-sm border border-[var(--border-main)] rounded-lg py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              max={line.invQty}
                              value={line.recQty}
                              onChange={(e) => handleLineChange(idx, "recQty", Number(e.target.value))}
                              className="w-24 text-center text-sm border border-[var(--border-main)] rounded-lg py-1.5 bg-[var(--bg-subtle)] font-mono font-bold text-[var(--text-primary)]"
                            />
                            {errors[`qty-${idx}`] && <p className="text-[var(--color-danger-text)] text-[10px] mt-1 font-semibold">{errors[`qty-${idx}`]}</p>}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={1}
                              value={line.price}
                              onChange={(e) => handleLineChange(idx, "price", Number(e.target.value))}
                              className="w-32 text-center text-sm border border-[var(--border-main)] rounded-lg py-1.5 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono font-medium"
                            />
                            {errors[`rate-${idx}`] && <p className="text-[var(--color-danger-text)] text-[10px] mt-1 font-semibold">{errors[`rate-${idx}`]}</p>}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-end gap-3 bg-[var(--bg-card)]">
                <button
                  type="button"
                  onClick={() => {
                    handleClearForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-all"
                >
                  Cancel
                </button>
                <Button type="submit" id="grn-submit-btn" variant="primary">
                  Post GRN
                </Button>
              </div>
            </form>
          )}

          {/* ── LIST: KPIs + filters + table ── */}
          <ModuleKpiRow items={kpis} />

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <div className="pb-3 border-b border-[var(--border-main)] mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
                  Goods Receipt Notes
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Showing{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {total === 0
                      ? 0
                      : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {total}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {" "}
                    · server filters · {pageSize}/page
                  </span>
                </p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="relative xl:col-span-2">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search GRN / PO / tool no / supplier…"
                  className="w-full h-9 pl-8 pr-3 text-xs border border-[var(--border-main)] rounded-lg bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs border border-[var(--border-main)] rounded-lg px-3 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
              >
                <option value="ALL">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs border border-[var(--border-main)] rounded-lg px-3 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
              >
                <option value="ALL">All suppliers</option>
                {supplierOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  title="From date"
                  className="h-9 flex-1 min-w-0 text-xs border border-[var(--border-main)] rounded-lg px-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  title="To date"
                  className="h-9 flex-1 min-w-0 text-xs border border-[var(--border-main)] rounded-lg px-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] font-mono outline-none focus:ring-2 focus:ring-[var(--primary-subtle)]"
                />
              </div>
            </div>

            {(searchQuery || statusFilter !== "ALL" || supplierFilter !== "ALL" || dateFrom || dateTo) && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            <DataTable
              columns={columns}
              rows={filteredGrns}
              loading={loading}
              rowKey={(g) => g.girNo}
              emptyText="No GRN records match the current filters."
              expandedKey={expandedGrn}
              onToggleExpand={(g) =>
                setExpandedGrn((prev) => (prev === g.girNo ? null : g.girNo))
              }
              renderExpanded={(g) => (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--text-muted)] font-bold text-[10px] uppercase bg-[var(--bg-subtle)] border-b border-[var(--border-main)]">
                        {["Tool No", "Name", "Inv Qty", "Received", "Unit Price", "Line amount"].map(
                          (col) => (
                            <th key={col} className="text-left py-2 px-3">
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {(g.lines ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-xs text-[var(--text-muted)]"
                          >
                            No line items on this GRN.
                          </td>
                        </tr>
                      ) : (
                        (g.lines ?? []).map((line) => {
                          const amt = toNum(line.recQty) * toNum(line.price);
                          return (
                            <tr
                              key={line.rowId}
                              className="text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-hover)]"
                            >
                              <td className="py-2.5 px-3 font-mono font-semibold">
                                {line.itemCode}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                                {line.tool?.name ?? line.itemCode}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                                {toNum(line.invQty)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-[var(--color-success-text)]">
                                {toNum(line.recQty)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">
                                {formatInr(toNum(line.price))}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">
                                {formatInr(amt)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            />

            {total > pageSize && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-[var(--border-main)]">
                <p className="text-xs text-[var(--text-muted)]">
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total)} of {total}
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
