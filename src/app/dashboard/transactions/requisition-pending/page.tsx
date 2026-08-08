"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Clock,
  FileText,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { TablePager } from "@/components/TablePager";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { OverlayModal } from "@/components/ui/OverlayModal";
import { apiGet, apiPost } from "@/lib/apiClient";
import { downloadExcel } from "@/lib/downloadExcel";
import { toastSuccess, toastError } from "@/lib/appToast";
import RoleGate from "@/app/dashboard/components/RoleGate";

type RaiseLine = {
  toolOrGaugeNo: string;
  toolName: string;
  reqQty: number;
  uom: string;
  machine: string;
};

/* ───────── types ───────── */
interface ReqLine {
  rowId: number;
  reqNo: string | null;
  reqDate: string | null;
  deptId: number | null;
  empCd: number | null;
  headerStatus: string | null;
  matType: string | null;
  fromWhere: string | null;
  toolOrGaugeNo: string | null;
  toolName: string | null;
  grouping: string | null;
  description: string | null;
  machine: string | null;
  reqQty: number;
  issueQty: number;
  balanceQty: number;
  uom: string | null;
  lineStatus: string | null;
  remarks: string | null;
  creatUserIdCd: string;
  pending: boolean;
}

/* ───────── helpers ───────── */
function fmtDate(v: string | null) {
  if (!v) return "—";
  return v.includes("T") ? v.split("T")[0] : v;
}

function agingDays(reqDate: string | null): number {
  if (!reqDate) return 0;
  const d = new Date(reqDate);
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function AgingBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  if (days >= 14)
    return (
      <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
        <AlertTriangle className="w-2.5 h-2.5" />
        {days}d
      </span>
    );
  if (days >= 7)
    return (
      <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
        <Clock className="w-2.5 h-2.5" />
        {days}d
      </span>
    );
  return null;
}

function QtyBar({ issued, total }: { issued: number; total: number }) {
  if (total <= 0) return <span className="text-[var(--text-muted)]">—</span>;
  const pct = Math.min(100, Math.round((issued / total) * 100));
  const color =
    pct === 0
      ? "bg-amber-400"
      : pct < 100
        ? "bg-blue-400"
        : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] shrink-0">{pct}%</span>
    </div>
  );
}

/* ───────── Detail Drawer ───────── */
function DetailDrawer({
  line,
  onClose,
}: {
  line: ReqLine;
  onClose: () => void;
}) {
  const days = agingDays(line.reqDate);
  const fulfillUrl = line.reqNo
    ? `/dashboard/transactions/issue?action=add&requisitionPending=Yes&reqNo=${encodeURIComponent(line.reqNo)}`
    : `/dashboard/transactions/issue?action=add&requisitionPending=Yes`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl flex flex-col h-full border-l border-[var(--border-main)] animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[var(--primary)]">
                <FileText className="w-3.5 h-3.5" />
                {line.reqNo ?? "No Req No"}
              </span>
              {days >= 7 && <AgingBadge days={days} />}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Raised on {fmtDate(line.reqDate)}
              {line.deptId ? ` · Dept ${line.deptId}` : ""}
              {line.empCd ? ` · Emp ${line.empCd}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Fulfilment progress */}
          <div className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Fulfilment Progress
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Requested", value: line.reqQty, unit: line.uom },
                { label: "Issued", value: line.issueQty, unit: line.uom, color: "text-blue-600 dark:text-blue-400" },
                {
                  label: "Balance",
                  value: line.balanceQty,
                  unit: line.uom,
                  color:
                    line.balanceQty === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400",
                },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] p-3">
                  <p className={`text-xl font-bold tabular-nums ${s.color ?? "text-[var(--text-primary)]"}`}>
                    {s.value}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.label}</p>
                  {s.unit && <p className="text-[10px] text-[var(--text-muted)]">{s.unit}</p>}
                </div>
              ))}
            </div>
            <QtyBar issued={line.issueQty} total={line.reqQty} />
          </div>

          {/* Tool Info */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Tool Details
            </p>
            {[
              { label: "Tool / Gauge No", value: line.toolOrGaugeNo, mono: true },
              { label: "Tool Name", value: line.toolName },
              { label: "Group", value: line.grouping },
              { label: "Description", value: line.description },
              { label: "Machine", value: line.machine },
            ].map(
              ({ label, value, mono }) =>
                value && (
                  <div key={label} className="flex gap-3">
                    <span className="text-[11px] text-[var(--text-muted)] w-28 shrink-0 pt-0.5">{label}</span>
                    <span className={`text-xs text-[var(--text-primary)] flex-1 ${mono ? "font-mono" : ""}`}>
                      {value}
                    </span>
                  </div>
                )
            )}
          </div>

          {/* Status */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-2 items-center">
                <span className="text-[11px] text-[var(--text-muted)]">Header:</span>
                <StatusBadge status={line.headerStatus || "—"} />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-[11px] text-[var(--text-muted)]">Line:</span>
                <StatusBadge status={line.lineStatus || line.headerStatus || "—"} />
              </div>
            </div>
          </div>

          {/* Requisition metadata */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Requisition Metadata
            </p>
            {[
              { label: "Mat Type", value: line.matType },
              { label: "From Where", value: line.fromWhere },
              { label: "Raised By", value: line.creatUserIdCd },
              { label: "Remarks", value: line.remarks },
            ].map(
              ({ label, value }) =>
                value && (
                  <div key={label} className="flex gap-3">
                    <span className="text-[11px] text-[var(--text-muted)] w-28 shrink-0 pt-0.5">{label}</span>
                    <span className="text-xs text-[var(--text-primary)] flex-1">{value}</span>
                  </div>
                )
            )}
          </div>

          {/* Action */}
          {line.pending && line.toolOrGaugeNo && (
            <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-light)] p-4">
              <p className="text-xs font-semibold text-[var(--primary)] mb-1">
                Ready to fulfil this requisition?
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mb-3">
                Go to Tool Issue to raise a DC for{" "}
                <span className="font-mono font-semibold">{line.toolOrGaugeNo}</span>{" "}
                against this requisition.
              </p>
              <Link href={fulfillUrl}>
                <Button variant="primary" size="sm" className="w-full justify-center gap-2">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Go to Tool Issue
                </Button>
              </Link>
            </div>
          )}

          {!line.pending && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                This requisition line has been fulfilled — issued qty meets or exceeds the requested qty.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Main Page ───────── */
export default function RequisitionPendingPage() {
  const [items, setItems] = useState<ReqLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "fulfilled" | "all">("pending");
  /** ERP Status dropdown: OPEN / CLOSED / ALL */
  const [headerStatus, setHeaderStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  /** ERP Cons.Dt? — Yes applies From/To */
  const [considerDate, setConsiderDate] = useState<"Yes" | "No">("No");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [fulfilledCount, setFulfilledCount] = useState(0);
  const [uniquePendingReqs, setUniquePendingReqs] = useState(0);
  const [toolLineCount, setToolLineCount] = useState(0);
  const [error, setError] = useState("");
  const [selectedLine, setSelectedLine] = useState<ReqLine | null>(null);
  const [selectedReqNos, setSelectedReqNos] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showRaise, setShowRaise] = useState(false);
  const [raising, setRaising] = useState(false);
  const [raiseDate, setRaiseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raiseDeptId, setRaiseDeptId] = useState("");
  const [raiseEmpCd, setRaiseEmpCd] = useState("");
  const [raiseRemarks, setRaiseRemarks] = useState("");
  const [raiseLines, setRaiseLines] = useState<RaiseLine[]>([
    { toolOrGaugeNo: "", toolName: "", reqQty: 1, uom: "", machine: "" },
  ]);
  const [toolQuery, setToolQuery] = useState("");
  const [toolHits, setToolHits] = useState<
    { toolOrGaugeNo: string; name: string | null; uom: string | null }[]
  >([]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const pageSize = 50;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(
    (p: number, q: string, status: string) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
        status,
        considerDate,
      });
      if (q.trim()) params.set("search", q.trim());
      if (headerStatus !== "ALL") params.set("headerStatus", headerStatus);
      if (considerDate === "Yes") {
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
      }
      return params;
    },
    [considerDate, fromDate, toDate, headerStatus]
  );

  const load = useCallback(
    async (p = page, q = search, status = statusFilter) => {
      setLoading(true);
      setError("");
      const params = buildParams(p, q, status);
      const res = await apiGet<{
        items: ReqLine[];
        total: number;
        pendingCount: number;
        fulfilledCount: number;
        uniquePendingReqs: number;
        toolLineCount: number;
        error?: string;
      }>(`/api/requisition-pending?${params}`);
      if (res.error) {
        setError(res.error.message);
        setItems([]);
        setTotal(0);
      } else {
        const nextItems = res.data?.items ?? [];
        setItems(nextItems);
        setTotal(res.data?.total ?? 0);
        setPendingCount(res.data?.pendingCount ?? 0);
        setFulfilledCount(res.data?.fulfilledCount ?? 0);
        setUniquePendingReqs(res.data?.uniquePendingReqs ?? 0);
        setToolLineCount(res.data?.toolLineCount ?? 0);
        if (res.data?.error) setError(res.data.error);
        // Keep detail drawer in sync after issue write-back / reconcile
        setSelectedLine((prev) => {
          if (!prev) return null;
          return nextItems.find((r) => r.rowId === prev.rowId) ?? null;
        });
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, search, statusFilter, buildParams]
  );

  useEffect(() => {
    void load(1, "", "pending");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      void load(1, val, statusFilter);
    }, 350);
  };

  const onStatusChange = (val: "pending" | "fulfilled" | "all") => {
    setStatusFilter(val);
    // OPEN filter hides CLOSED headers — switch Status with the tab so Fulfilled is visible
    const nextHeader =
      val === "fulfilled" ? "CLOSED" : val === "pending" ? "OPEN" : "ALL";
    setHeaderStatus(nextHeader);
    setPage(1);
    // load via effect on headerStatus+statusFilter would race; pass filters explicitly
    void (async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(pageSize),
        status: val,
        considerDate,
        headerStatus: nextHeader,
      });
      if (search.trim()) params.set("search", search.trim());
      if (considerDate === "Yes") {
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
      }
      const res = await apiGet<{
        items: ReqLine[];
        total: number;
        pendingCount: number;
        fulfilledCount: number;
        uniquePendingReqs: number;
        toolLineCount: number;
        error?: string;
      }>(`/api/requisition-pending?${params}`);
      if (res.error) {
        setError(res.error.message);
        setItems([]);
        setTotal(0);
      } else {
        const nextItems = res.data?.items ?? [];
        setItems(nextItems);
        setTotal(res.data?.total ?? 0);
        setPendingCount(res.data?.pendingCount ?? 0);
        setFulfilledCount(res.data?.fulfilledCount ?? 0);
        setUniquePendingReqs(res.data?.uniquePendingReqs ?? 0);
        setToolLineCount(res.data?.toolLineCount ?? 0);
        if (res.data?.error) setError(res.data.error);
        setSelectedLine((prev) => {
          if (!prev) return null;
          return nextItems.find((r) => r.rowId === prev.rowId) ?? null;
        });
      }
      setLoading(false);
    })();
  };

  const handleExport = async () => {
    setExporting(true);
    // Load all for export (no page limit)
    const params = new URLSearchParams({ page: "1", pageSize: "500", status: statusFilter });
    if (search.trim()) params.set("search", search.trim());
    const res = await apiGet<{ items: ReqLine[] }>(`/api/requisition-pending?${params}`);
    const rows = res.data?.items ?? [];
    downloadExcel({
      filename: `requisition_pending_${statusFilter}`,
      sheetName: "Requisitions",
      columns: [
        { key: "reqNo", label: "Req No" },
        { key: "reqDate", label: "Date", value: (r) => fmtDate(r.reqDate) },
        { key: "toolOrGaugeNo", label: "Tool No" },
        { key: "toolName", label: "Tool Name" },
        { key: "description", label: "Description" },
        { key: "reqQty", label: "Req Qty" },
        { key: "issueQty", label: "Issued Qty" },
        { key: "balanceQty", label: "Balance Qty" },
        { key: "uom", label: "UOM" },
        { key: "lineStatus", label: "Line Status" },
        { key: "headerStatus", label: "Header Status" },
        { key: "machine", label: "Machine" },
        { key: "deptId", label: "Dept ID" },
        { key: "matType", label: "Mat Type" },
        { key: "remarks", label: "Remarks" },
        { key: "creatUserIdCd", label: "Raised By" },
      ],
      rows,
    });
    setExporting(false);
  };

  // Compute urgency stats
  const overdue14 = items.filter((r) => r.pending && agingDays(r.reqDate) >= 14).length;

  const resetRaiseForm = () => {
    setRaiseDate(new Date().toISOString().slice(0, 10));
    setRaiseDeptId("");
    setRaiseEmpCd("");
    setRaiseRemarks("");
    setRaiseLines([{ toolOrGaugeNo: "", toolName: "", reqQty: 1, uom: "", machine: "" }]);
    setToolQuery("");
    setToolHits([]);
    setActiveLineIdx(0);
  };

  const searchToolsForLine = (idx: number, q: string) => {
    setActiveLineIdx(idx);
    setToolQuery(q);
    setRaiseLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, toolOrGaugeNo: q, toolName: "" } : l))
    );
    if (toolSearchTimer.current) clearTimeout(toolSearchTimer.current);
    if (!q.trim()) {
      setToolHits([]);
      return;
    }
    toolSearchTimer.current = setTimeout(async () => {
      const res = await apiGet<{
        items?: { toolOrGaugeNo: string; name: string | null; uom: string | null }[];
      }>(`/api/tools?search=${encodeURIComponent(q.trim())}&pageSize=8`);
      setToolHits(res.data?.items ?? []);
    }, 300);
  };

  const pickTool = (idx: number, t: { toolOrGaugeNo: string; name: string | null; uom: string | null }) => {
    setRaiseLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              toolOrGaugeNo: t.toolOrGaugeNo,
              toolName: t.name || t.toolOrGaugeNo,
              uom: t.uom || l.uom,
            }
          : l
      )
    );
    setToolHits([]);
    setToolQuery("");
  };

  const handleRaiseSubmit = async () => {
    const lines = raiseLines
      .map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo.trim(),
        reqQty: Number(l.reqQty) || 0,
        uom: l.uom || undefined,
        machine: l.machine || undefined,
        description: l.toolName || undefined,
        remarks: raiseRemarks || undefined,
      }))
      .filter((l) => l.toolOrGaugeNo && l.reqQty > 0);

    if (lines.length === 0) {
      toastError("Add at least one tool with quantity.");
      return;
    }

    setRaising(true);
    const res = await apiPost<{ reqNo?: string; error?: string }>("/api/requisition-pending", {
      reqDate: raiseDate,
      deptId: raiseDeptId.trim() ? Number(raiseDeptId) : null,
      empCd: raiseEmpCd.trim() ? Number(raiseEmpCd) : null,
      matType: "TOOLS",
      remarks: raiseRemarks || undefined,
      lines,
    });
    setRaising(false);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    toastSuccess({
      title: "Requisition raised",
      message: `OPEN requisition ${res.data?.reqNo ?? ""} created.`,
      detail: "It will appear in Req No when Issue → Requisition Pending = Yes.",
    });
    setShowRaise(false);
    resetRaiseForm();
    setHeaderStatus("OPEN");
    setStatusFilter("pending");
    setPage(1);
    void load(1, "", "pending");
  };

  return (
    <SimpleMasterShell
      title="Requisition Pending"
      subtitle="Raise tool MRs into MATERIAL_REQUISITION_* · fulfil via Issue For Tools"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <RoleGate permission="canCreateIssue">
            <Button
              id="req-pending-raise-btn"
              variant="primary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                resetRaiseForm();
                setShowRaise(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Raise Requisition
            </Button>
          </RoleGate>
          <Link
            href={
              selectedReqNos.size === 1
                ? `/dashboard/transactions/issue?action=add&requisitionPending=Yes&reqNo=${encodeURIComponent(
                    [...selectedReqNos][0]
                  )}`
                : "/dashboard/transactions/issue?action=add&requisitionPending=Yes"
            }
          >
            <Button
              id="req-pending-issue-for-tools-btn"
              variant="outline"
              size="sm"
              className="gap-1.5"
              title="ERP: Issue For Tools — opens Tool Issue with Requisition Pending = Yes"
            >
              <Package className="w-3.5 h-3.5" />
              Issue For Tools
              {selectedReqNos.size === 1 ? ` (${[...selectedReqNos][0]})` : ""}
            </Button>
          </Link>
          <Button
            id="req-pending-export-btn"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || loading}
            className="gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : "Export Excel"}
          </Button>
        </div>
      }
    >
      {/* ── What is this module? ── */}
      <div className="mb-5 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4 flex gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--primary-light)] flex items-center justify-center">
          <Info className="w-4 h-4 text-[var(--primary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            What is Requisition Pending?
          </p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Use <strong>Raise Requisition</strong> to create an OPEN Material Requisition (writes ERP tables{" "}
            <span className="font-mono">MATERIAL_REQUISITION_*</span>). Then select it and click{" "}
            <strong>Issue For Tools</strong> (or Tool Issue → Requisition Pending = Yes). A line stays pending until
            issued qty meets requested qty.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[
              { icon: ClipboardList, label: "Pending", desc: "Shopfloor raised, not yet issued", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
              { icon: Package, label: "Partial", desc: "Some qty issued, balance open", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
              { icon: CheckCircle2, label: "Fulfilled", desc: "Issued qty ≥ Requested qty", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 border border-[var(--border-main)] ${color}`}>
                <Icon className="w-3.5 h-3.5" />
                <div>
                  <span className="text-[11px] font-semibold">{label}</span>
                  <span className="text-[11px] text-[var(--text-muted)] ml-1.5">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Overdue alert ── */}
      {overdue14 > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
            <strong>{overdue14}</strong> requisition line{overdue14 !== 1 ? "s are" : " is"} pending for{" "}
            <strong>14+ days</strong> — urgent fulfillment needed.
          </p>
        </div>
      )}

      {/* ── KPI Row ── */}
      <ModuleKpiRow
        items={[
          {
            id: "pending-lines",
            label: "Pending Lines",
            value: pendingCount,
            subtext: "Open / unfulfilled tool lines",
            icon: ClipboardList,
            iconBg: "bg-amber-50 dark:bg-amber-950/30",
            iconColor: "text-amber-600 dark:text-amber-400",
            badge: { label: "Pending", type: "warning" },
          },
          {
            id: "pending-reqs",
            label: "Pending Requisitions",
            value: uniquePendingReqs,
            subtext: "Distinct REQ_NO still open",
            icon: FileText,
            iconBg: "bg-[var(--primary-light)]",
            iconColor: "text-[var(--primary)]",
            badge: { label: "Headers", type: "info" },
          },
          {
            id: "tool-lines",
            label: "Tool Lines (all)",
            value: toolLineCount,
            subtext: "Rows with TOOL_GAUGE_NO set",
            icon: Clock,
            iconBg: "bg-blue-50 dark:bg-blue-950/30",
            iconColor: "text-blue-600 dark:text-blue-400",
            badge: { label: "Tools", type: "info" },
          },
          {
            id: "fulfilled",
            label: "Fulfilled Lines",
            value: fulfilledCount,
            subtext: "Issued qty covers request",
            icon: ShieldCheck,
            iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            badge: { label: "Done", type: "success" },
          },
        ]}
      />

      {/* ── Status tabs ── */}
      <StatusPillTabs
        className="mb-3"
        idPrefix="req-pending-status"
        value={statusFilter}
        onChange={onStatusChange}
        items={[
          { value: "pending", label: "Pending", count: pendingCount },
          { value: "fulfilled", label: "Fulfilled", count: fulfilledCount },
          { value: "all", label: "All tool lines", count: toolLineCount },
        ]}
      />

      {/* ── ERP filters (Status / Cons.Dt? / From–To / Req No) ── */}
      <div className="mb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-0.5">Status</label>
          <select
            value={headerStatus}
            onChange={(e) => {
              const v = e.target.value as "OPEN" | "CLOSED" | "ALL";
              setHeaderStatus(v);
              setPage(1);
              // buildParams still has old headerStatus — fetch with new value
              void (async () => {
                setLoading(true);
                const params = new URLSearchParams({
                  page: "1",
                  pageSize: String(pageSize),
                  status: statusFilter,
                  considerDate,
                  headerStatus: v,
                });
                if (search.trim()) params.set("search", search.trim());
                if (considerDate === "Yes") {
                  if (fromDate) params.set("fromDate", fromDate);
                  if (toDate) params.set("toDate", toDate);
                }
                const res = await apiGet<{
                  items: ReqLine[];
                  total: number;
                  pendingCount: number;
                  fulfilledCount: number;
                  uniquePendingReqs: number;
                  toolLineCount: number;
                }>(`/api/requisition-pending?${params}`);
                setItems(res.data?.items ?? []);
                setTotal(res.data?.total ?? 0);
                setPendingCount(res.data?.pendingCount ?? 0);
                setFulfilledCount(res.data?.fulfilledCount ?? 0);
                setUniquePendingReqs(res.data?.uniquePendingReqs ?? 0);
                setToolLineCount(res.data?.toolLineCount ?? 0);
                setLoading(false);
              })();
            }}
            className="form-control h-8 text-xs"
          >
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-0.5">Cons.Dt?</label>
          <select
            value={considerDate}
            onChange={(e) => setConsiderDate(e.target.value as "Yes" | "No")}
            className="form-control h-8 text-xs"
            title="ERP: Yes = apply From/To dates"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-0.5">From Date</label>
          <input
            type="date"
            value={fromDate}
            disabled={considerDate === "No"}
            onChange={(e) => setFromDate(e.target.value)}
            className="form-control h-8 text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-0.5">To Date</label>
          <input
            type="date"
            value={toDate}
            disabled={considerDate === "No"}
            onChange={(e) => setToDate(e.target.value)}
            className="form-control h-8 text-xs"
          />
        </div>
        <div className="col-span-2 flex items-end gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setPage(1);
              void load(1, search, statusFilter);
            }}
            disabled={loading}
          >
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setHeaderStatus("OPEN");
              setConsiderDate("No");
              setFromDate("");
              setToDate("");
              setPage(1);
              void load(1, search, statusFilter);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* ── Main table ── */}
      <MasterTableCard
        toolbar={
          <>
            <MasterSearchInput
              id="req-pending-search"
              value={search}
              onChange={onSearch}
              placeholder="Req No / tool / description…"
              widthClass="w-64"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 !rounded-md !px-2 !text-[11px] shrink-0 gap-1"
              onClick={() => void load(page, search, statusFilter)}
              disabled={loading}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
        footer={
          <TablePager
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(n) => {
              setPage(n);
              void load(n, search, statusFilter);
            }}
            disabled={loading}
            idPrefix="req-pending"
          />
        }
      >
        {error && (
          <div className="px-4 py-3 flex items-center gap-2 border-b border-[var(--border-main)] bg-rose-50 dark:bg-rose-950/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto">
              <ClipboardList className="w-7 h-7 text-[var(--text-muted)] opacity-60" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No {statusFilter === "pending" ? "pending " : statusFilter === "fulfilled" ? "fulfilled " : ""}tool requisitions found
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
              {statusFilter === "pending"
                ? "No open tool requisitions at the moment. Shopfloor raises a Material Requisition in the ERP system — it will appear here automatically."
                : "No records match your current search / filter. Try switching tabs or clearing the search."}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] font-mono max-w-sm mx-auto">
              Source: MATERIAL_REQUISITION_MASTER / MATERIAL_REQUISITION_TRANS where TOOL_GAUGE_NO is set
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1060px]">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                  {[
                    "",
                    "Req No",
                    "Date",
                    "Tool No",
                    "Name / Description",
                    "Req Qty",
                    "Issued",
                    "Balance",
                    "Progress",
                    "Status",
                    "Machine",
                    "Dept",
                    "",
                  ].map((col, i) => (
                    <th
                      key={col || `sel-${i}`}
                      className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap last:w-8"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {items.map((row) => {
                  const days = agingDays(row.reqDate);
                  const checked = row.reqNo ? selectedReqNos.has(row.reqNo) : false;
                  return (
                    <tr
                      key={row.rowId}
                      className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
                      onClick={() => setSelectedLine(row)}
                    >
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.reqNo && row.pending ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedReqNos((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.reqNo!)) next.delete(row.reqNo!);
                                else {
                                  next.clear();
                                  next.add(row.reqNo!);
                                }
                                return next;
                              });
                            }}
                            className="rounded border-[var(--border-main)]"
                            title="Select for Issue For Tools"
                          />
                        ) : null}
                      </td>
                      {/* Req No */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                          {row.reqNo ?? "—"}
                        </span>
                        <AgingBadge days={days} />
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                        {fmtDate(row.reqDate)}
                      </td>

                      {/* Tool No */}
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                        {row.toolOrGaugeNo ?? "—"}
                      </td>

                      {/* Name / Description */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {row.toolName || row.description || "—"}
                        </p>
                        {row.toolName && row.description && (
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{row.description}</p>
                        )}
                        {row.grouping && (
                          <p className="text-[10px] text-[var(--text-muted)]">{row.grouping}</p>
                        )}
                      </td>

                      {/* Req Qty */}
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                        {row.reqQty}
                        {row.uom ? <span className="ml-0.5 text-[10px]">{row.uom}</span> : ""}
                      </td>

                      {/* Issued */}
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                        {row.issueQty}
                      </td>

                      {/* Balance */}
                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums font-semibold">
                        <span
                          className={
                            row.balanceQty === 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : row.balanceQty > 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[var(--text-primary)]"
                          }
                        >
                          {row.balanceQty}
                        </span>
                      </td>

                      {/* Progress bar */}
                      <td className="py-2.5 px-3 min-w-[100px]">
                        <QtyBar issued={row.issueQty} total={row.reqQty} />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <StatusBadge status={row.lineStatus || row.headerStatus || "—"} />
                      </td>

                      {/* Machine */}
                      <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">
                        {row.machine || "—"}
                      </td>

                      {/* Dept */}
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                        {row.deptId ?? "—"}
                      </td>

                      {/* Expand arrow */}
                      <td className="py-2.5 px-3 text-right">
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>

      {/* ── Workflow hint (only when there is data) ── */}
      {!loading && items.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            How to fulfil a requisition
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            {[
              "1. Raise Requisition (or use an OPEN MR from ERP)",
              "2. Select the Req No checkbox",
              "3. Click Issue For Tools",
              "4. Submit the DC — Balance moves to 0 when fully issued",
            ].map((step, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                {step.slice(3)}
                {i < 3 && <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {selectedLine && (
        <DetailDrawer line={selectedLine} onClose={() => setSelectedLine(null)} />
      )}

      {/* ── Raise Requisition ── */}
      <OverlayModal
        open={showRaise}
        onClose={() => {
          if (!raising) {
            setShowRaise(false);
            resetRaiseForm();
          }
        }}
        title="Raise Requisition"
        subtitle="Creates OPEN Material Requisition (TOOLS) in ERP tables"
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={raising}
              onClick={() => {
                setShowRaise(false);
                resetRaiseForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={raising}
              onClick={() => void handleRaiseSubmit()}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {raising ? "Saving…" : "Save Requisition"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Req Date</label>
              <input
                type="date"
                value={raiseDate}
                onChange={(e) => setRaiseDate(e.target.value)}
                className="form-control"
              />
            </div>
            <div>
              <label className="form-label">Dept ID</label>
              <input
                type="number"
                value={raiseDeptId}
                onChange={(e) => setRaiseDeptId(e.target.value)}
                className="form-control"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="form-label">Emp Code</label>
              <input
                type="number"
                value={raiseEmpCd}
                onChange={(e) => setRaiseEmpCd(e.target.value)}
                className="form-control"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Mat Type</label>
            <input value="TOOLS" readOnly className="form-control opacity-80 cursor-not-allowed" />
          </div>
          <div>
            <label className="form-label">Remarks</label>
            <input
              value={raiseRemarks}
              onChange={(e) => setRaiseRemarks(e.target.value)}
              className="form-control"
              maxLength={500}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Tool lines
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  setRaiseLines((prev) => [
                    ...prev,
                    { toolOrGaugeNo: "", toolName: "", reqQty: 1, uom: "", machine: "" },
                  ])
                }
              >
                <Plus className="w-3 h-3" /> Add line
              </Button>
            </div>

            {raiseLines.map((line, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3 space-y-2 relative"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2 relative">
                    <label className="form-label">Tool / Gauge No *</label>
                    <input
                      value={line.toolOrGaugeNo}
                      onChange={(e) => searchToolsForLine(idx, e.target.value)}
                      onFocus={() => setActiveLineIdx(idx)}
                      className="form-control font-mono"
                      placeholder="Search tool no…"
                      autoComplete="off"
                    />
                    {activeLineIdx === idx && toolHits.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] shadow-lg max-h-40 overflow-auto">
                        {toolHits.map((t) => (
                          <button
                            key={t.toolOrGaugeNo}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] border-b border-[var(--border-main)] last:border-0"
                            onClick={() => pickTool(idx, t)}
                          >
                            <span className="font-mono font-semibold">{t.toolOrGaugeNo}</span>
                            <span className="text-[var(--text-muted)] ml-2">{t.name || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {line.toolName && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{line.toolName}</p>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Req Qty *</label>
                    <input
                      type="number"
                      min={1}
                      value={line.reqQty}
                      onChange={(e) =>
                        setRaiseLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, reqQty: Math.max(1, Number(e.target.value) || 1) } : l
                          )
                        )
                      }
                      className="form-control"
                    />
                  </div>
                  <div>
                    <label className="form-label">Machine</label>
                    <input
                      value={line.machine}
                      onChange={(e) =>
                        setRaiseLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, machine: e.target.value } : l))
                        )
                      }
                      className="form-control"
                      maxLength={20}
                    />
                  </div>
                </div>
                {raiseLines.length > 1 && (
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    onClick={() => setRaiseLines((prev) => prev.filter((_, i) => i !== idx))}
                    title="Remove line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </OverlayModal>
    </SimpleMasterShell>
  );
}
