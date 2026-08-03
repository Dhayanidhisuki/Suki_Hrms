"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  CheckCircle2,
  ArrowLeft,
  ArrowDownLeft,
  ShieldAlert,
  Plus,
  Trash,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { Clock } from "lucide-react";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

interface ToolMasterPreview {
  toolOrGaugeNo: string | null;
  name: string | null;
  description: string | null;
  type: string | null;
  grouping: string | null;
  uom: string | null;
}

interface ToolsIssueLine {
  rowId: number;
  dcNo: string;
  toolOrGaugeNo: string | null;
  issueQty: number | string;
  partNo: string | null;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  groupName?: string | null;
  serialNo?: number | null;
  uom?: string | null;
  issueToItemNo?: string | null;
  toolRefNo?: number | null;
  returnable?: string | null;
  remarks?: string | null;
  status?: string | null;
  dueDate?: string | null;
  tool?: ToolMasterPreview | null;
  toolByRef?: ToolMasterPreview | null;
}

interface ToolsIssueHeader {
  dcNo: string;
  receiveName: string | null;
  receiveNameTwo?: string | null;
  subCode: string | null;
  issueOption?: string | null;
  empId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: string;
  lines: ToolsIssueLine[];
}

interface HistoryRow {
  recNo: number;
  grnNo: number;
  receiveDate: string | null;
  dcNo: string;
  receivedFrom: string | null;
  partyDcNo: string | null;
  receivedBy: string | null;
  subCode: string | null;
  vendorType: string | null;
  location: string | null;
  status: string | null;
  grouping: string | null;
  type: string | null;
  toolOrGaugeNo: string | null;
  serialNo: number | null;
  description: string | null;
  qty: number | null;
}

interface SubOption {
  id: string;
  subCode: string;
  subName: string;
}

interface StagedReceiveLine {
  issueRowId: number;
  dcNo: string;
  toolOrGaugeNo: string;
  description: string;
  serialNo: string;
  qty: number;
  maxQty: number;
  status: string;
  comments: string;
}

function lineKey(line: ToolsIssueLine) {
  return String(line.rowId);
}

function resolveToolNo(line: ToolsIssueLine): string {
  const master = line.tool ?? line.toolByRef;
  const raw =
    line.toolOrGaugeNo ||
    master?.toolOrGaugeNo ||
    line.issueToItemNo ||
    (line.partNo && line.partNo !== "-" ? line.partNo : null) ||
    "";
  return raw.trim() || `LINE-${line.rowId}`;
}

function resolveDesc(line: ToolsIssueLine): string {
  const master = line.tool ?? line.toolByRef;
  return (
    line.description ||
    line.name ||
    master?.description ||
    master?.name ||
    "—"
  );
}

function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStart() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function monthEnd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

const inputCls =
  "w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium";
const labelCls = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1";

const VENDOR_OPTIONS = ["ALL", "SubContractor", "Supplier", "Customer"] as const;

export default function ReceiveToolPage() {
  const { showSuccess } = useSuccessOverlay();
  const [mode, setMode] = useState<"list" | "receive">("list");

  // List (GRN history)
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [vendorType, setVendorType] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [overdueTotal, setOverdueTotal] = useState(0);
  const pageSize = 50;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Receive create
  const [openIssues, setOpenIssues] = useState<ToolsIssueHeader[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFrom, setPickerFrom] = useState(monthStart);
  const [pickerTo, setPickerTo] = useState(monthEnd);
  const [pickerSub, setPickerSub] = useState("ALL");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState<StagedReceiveLine[]>([]);
  const [activeDcNo, setActiveDcNo] = useState("");

  const [receiveDate, setReceiveDate] = useState(localToday);
  const [partyDcNo, setPartyDcNo] = useState("");
  const [contName, setContName] = useState("");
  const [poOrderNo, setPoOrderNo] = useState("");
  const [location, setLocation] = useState("");
  const [subCode, setSubCode] = useState("");
  const [geNo, setGeNo] = useState("");

  const [subs, setSubs] = useState<SubOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadHistory = useCallback(
    async (p = page, q = searchQuery) => {
      setLoading(true);
      const params = new URLSearchParams({
        history: "1",
        page: String(p),
        pageSize: String(pageSize),
        fromDate,
        toDate,
        vendorType,
        subCode: subFilter,
      });
      if (q.trim()) params.set("search", q.trim());
      const res = await apiGet<{
        items: HistoryRow[];
        total: number;
        pendingTotal: number;
        overdueTotal: number;
      }>(`/api/receive?${params}`);
      setHistory(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
      setPendingTotal(res.data?.pendingTotal ?? 0);
      setOverdueTotal(res.data?.overdueTotal ?? 0);
      setLoading(false);
    },
    [page, searchQuery, fromDate, toDate, vendorType, subFilter]
  );

  const loadOpenIssues = useCallback(async () => {
    setOpenLoading(true);
    const params = new URLSearchParams({
      open: "1",
      page: "1",
      pageSize: "100",
      fromDate: pickerFrom,
      toDate: pickerTo,
      subCode: pickerSub,
    });
    if (pickerSearch.trim()) params.set("search", pickerSearch.trim());
    const res = await apiGet<{ items: ToolsIssueHeader[] }>(`/api/receive?${params}`);
    setOpenIssues(res.data?.items ?? []);
    setOpenLoading(false);
  }, [pickerFrom, pickerTo, pickerSub, pickerSearch]);

  useEffect(() => {
    void loadHistory(1, "");
    void (async () => {
      const res = await apiGet<{ items?: SubOption[] }>("/api/subcontractors?pageSize=200");
      setSubs(res.data?.items ?? []);
    })();
  }, []);

  useEffect(() => {
    if (mode === "receive") void loadOpenIssues();
  }, [mode, loadOpenIssues]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadHistory(1, val), 350);
  };

  const openReceiveForm = () => {
    setMode("receive");
    setReceiveDate(localToday());
    setPartyDcNo("");
    setContName("");
    setPoOrderNo("");
    setLocation("");
    setSubCode("");
    setGeNo("");
    setStaged([]);
    setSelectedKeys(new Set());
    setActiveDcNo("");
    setErrors({});
    setBannerMsg(null);
  };

  const flatOpenLines = openIssues.flatMap((issue) =>
    issue.lines.map((line) => ({ issue, line }))
  );

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addToReceiveList = () => {
    const toAdd: StagedReceiveLine[] = [];
    let dc = activeDcNo;

    for (const { issue, line } of flatOpenLines) {
      const key = `${issue.dcNo}:${lineKey(line)}`;
      if (!selectedKeys.has(key)) continue;
      if (dc && dc !== issue.dcNo) {
        setBannerMsg({
          type: "error",
          text: "Select lines from one DC only for a receive (ERP: one Our DC No per GRN).",
        });
        return;
      }
      dc = issue.dcNo;
      if (staged.some((s) => s.issueRowId === line.rowId)) continue;
      toAdd.push({
        issueRowId: line.rowId,
        dcNo: issue.dcNo,
        toolOrGaugeNo: resolveToolNo(line),
        description: resolveDesc(line),
        serialNo: line.serialNo != null ? String(line.serialNo) : "",
        qty: Number(line.issueQty) || 1,
        maxQty: Number(line.issueQty) || 1,
        status: "Received",
        comments: "",
      });
    }

    if (!toAdd.length) {
      setBannerMsg({ type: "error", text: "Select one or more open issue lines first." });
      return;
    }

    setActiveDcNo(dc);
    setSubCode((prev) => prev || openIssues.find((i) => i.dcNo === dc)?.subCode || "");
    setContName((prev) => prev || openIssues.find((i) => i.dcNo === dc)?.receiveName || "");
    setStaged((prev) => [...prev, ...toAdd]);
    setSelectedKeys(new Set());
    setBannerMsg(null);
  };

  const patchStaged = (idx: number, patch: Partial<StagedReceiveLine>) => {
    setStaged((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};
    if (!activeDcNo) tempErrors.dc = "Add lines from an open DC first";
    if (!receiveDate) tempErrors.receiveDate = "Receive date is required";
    if (!staged.length) tempErrors.lines = "Receive list is empty";
    if (staged.some((l) => l.qty <= 0 || l.qty > l.maxQty)) {
      tempErrors.lines = "Check qty on each receive line";
    }
    if (Object.keys(tempErrors).length) {
      setErrors(tempErrors);
      return;
    }

    const payload = {
      dcNo: activeDcNo,
      receiveDate,
      subCode: subCode || undefined,
      partyDcNo: partyDcNo || undefined,
      contName: contName || undefined,
      vendorType: vendorType !== "ALL" ? vendorType : "SubContractor",
      poOrderNo: poOrderNo || undefined,
      location: location || undefined,
      geNo: geNo || undefined,
      lines: staged.map((l) => ({
        issueRowId: l.issueRowId,
        toolOrGaugeNo: l.toolOrGaugeNo.startsWith("LINE-") ? undefined : l.toolOrGaugeNo,
        quantity: l.qty,
        status: l.status,
        comments: l.comments || undefined,
      })),
    };

    setBannerMsg(null);
    const res = await apiPost<{ ok: boolean; header?: { recNo: number } }>("/api/receive", payload);
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    const grn = res.data?.header?.recNo;
    setSuccessMessage(`GRN #${grn ?? "—"} received against DC #${activeDcNo}`);
    showSuccess({
      title: "Receive posted",
      message: "Items/Asset receive saved.",
      detail: grn ? `GRN #${grn} · DC #${activeDcNo}` : `DC #${activeDcNo}`,
    });
    setMode("list");
    setStaged([]);
    void loadHistory(1, searchQuery);
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successMessage && (
            <div className="mb-4 p-4 bg-[var(--color-success-bg)] border border-[var(--border-main)] rounded-2xl flex items-center gap-2.5 text-[var(--color-success-text)] text-sm font-semibold shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {bannerMsg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                bannerMsg.type === "success"
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                  : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
              }`}
            >
              {bannerMsg.text}
              <button onClick={() => setBannerMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {mode === "list" ? (
            <>
              <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    Tools Issue Receive
                  </h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    GRN history + Items/Asset Receive (TOOLS_ISSUE_RECEIVED)
                  </p>
                </div>
                <RoleGate permission="canReceiveTool">
                  <Button type="button" variant="primary" onClick={openReceiveForm}>
                    <Plus className="w-4 h-4" /> Receive
                  </Button>
                </RoleGate>
              </div>

              <ModuleKpiRow
                items={[
                  {
                    id: "pending-returns",
                    label: "Pending Return DCs",
                    value: pendingTotal,
                    subtext: "Open issue DCs awaiting receive",
                    icon: ArrowDownLeft,
                    iconBg: "bg-[var(--primary-light)]",
                    iconColor: "text-[var(--primary)]",
                    badge: { label: "Pending", type: "info" },
                  },
                  {
                    id: "overdue-returns",
                    label: "Overdue Return Slips",
                    value: overdueTotal,
                    subtext: "Past scheduled return date",
                    icon: ShieldAlert,
                    iconBg: "bg-amber-50 dark:bg-amber-950/30",
                    iconColor: "text-amber-600 dark:text-amber-400",
                    badge: { label: "Overdue", type: "warning" },
                  },
                  {
                    id: "grn-rows",
                    label: "GRN Lines Shown",
                    value: history.length,
                    subtext: `Page ${page}`,
                    icon: Clock,
                    iconBg: "bg-blue-50 dark:bg-blue-950/30",
                    iconColor: "text-blue-600 dark:text-blue-400",
                    badge: { label: "Page", type: "info" },
                  },
                  {
                    id: "grn-total",
                    label: "Matching GRNs",
                    value: total,
                    subtext: "Filtered receive headers",
                    icon: CheckCircle2,
                    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                    iconColor: "text-emerald-600 dark:text-emerald-400",
                    badge: { label: "Listed", type: "success" },
                  },
                ]}
              />

              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className={labelCls}>From Date</label>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>To Date</label>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Select Option</label>
                    <select value={vendorType} onChange={(e) => setVendorType(e.target.value)} className={inputCls}>
                      {VENDOR_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Sub Contractor</label>
                    <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)} className={inputCls}>
                      <option value="ALL">ALL</option>
                      {subs.map((s) => (
                        <option key={s.subCode} value={s.subCode}>{s.subCode} — {s.subName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>GRN / DC Contains</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="GRN / DC / party…"
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPage(1);
                      void loadHistory(1, searchQuery);
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>

                <div className="overflow-auto">
                  {loading ? (
                    <TableSkeleton rows={5} />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {[
                            "#",
                            "GRN No",
                            "GRN.Date",
                            "DC.No",
                            "Received From",
                            "Party DC",
                            "Received By",
                            "Group",
                            "Type",
                            "Gauge/Tool No",
                            "S.NO",
                            "Description",
                            "Qty",
                            "Status",
                          ].map((col) => (
                            <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {history.map((row, idx) => (
                          <tr key={`${row.recNo}-${row.toolOrGaugeNo}-${idx}`} className="hover:bg-[var(--bg-hover)]">
                            <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">{(page - 1) * pageSize + idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono text-xs font-semibold">{row.grnNo}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.receiveDate ? String(row.receiveDate).split("T")[0] : "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.dcNo}</td>
                            <td className="py-2.5 px-3 text-xs">{row.receivedFrom || "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.partyDcNo || "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.receivedBy || "—"}</td>
                            <td className="py-2.5 px-3 text-xs">{row.grouping || "—"}</td>
                            <td className="py-2.5 px-3 text-xs">{row.type || "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.toolOrGaugeNo || "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.serialNo ?? "—"}</td>
                            <td className="py-2.5 px-3 text-xs">{row.description || "—"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{row.qty ?? "—"}</td>
                            <td className="py-2.5 px-3 text-xs">{row.status || "—"}</td>
                          </tr>
                        ))}
                        {history.length === 0 && (
                          <tr>
                            <td colSpan={14} className="py-8 text-center text-sm text-[var(--text-muted)]">
                              No records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {total > pageSize && (
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-main)]">
                    <p className="text-xs text-[var(--text-muted)]">
                      Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} out of {total}
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => { const n = page - 1; setPage(n); void loadHistory(n, searchQuery); }}>Previous</Button>
                      <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => { const n = page + 1; setPage(n); void loadHistory(n, searchQuery); }}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleConfirmReceive} className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to GRN list
                </button>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">Items / Asset Receive</h1>
              </div>

              {/* Picker filters */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className={labelCls}>GRN No</label>
                    <input value="Auto" readOnly className={`${inputCls} opacity-70`} />
                  </div>
                  <div>
                    <label className={labelCls}>Rec.Date</label>
                    <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>From</label>
                    <input type="date" value={pickerFrom} onChange={(e) => setPickerFrom(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>To</label>
                    <input type="date" value={pickerTo} onChange={(e) => setPickerTo(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Sub Contractor</label>
                    <select value={pickerSub} onChange={(e) => setPickerSub(e.target.value)} className={inputCls}>
                      <option value="ALL">ALL</option>
                      {subs.map((s) => (
                        <option key={s.subCode} value={s.subCode}>{s.subCode}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
                    <label className={labelCls}>Gauge / Tool No</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Filter open DC / tool…"
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void loadOpenIssues()}>
                    Search
                  </Button>
                </div>

                <div className="overflow-auto max-h-64 border border-[var(--border-main)] rounded-xl">
                  {openLoading ? (
                    <TableSkeleton rows={4} />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["", "Dc.No", "Receiver Name", "Party", "Gauge/Tool", "Sl.No", "Qty", "Description", "Due.Dat", "Status"].map((c) => (
                            <th key={c} className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2 px-2">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {flatOpenLines.map(({ issue, line }) => {
                          const key = `${issue.dcNo}:${lineKey(line)}`;
                          return (
                            <tr key={key} className="hover:bg-[var(--bg-hover)]">
                              <td className="py-2 px-2">
                                <input
                                  type="checkbox"
                                  checked={selectedKeys.has(key)}
                                  onChange={() => toggleSelect(key)}
                                />
                              </td>
                              <td className="py-2 px-2 font-mono text-xs">{issue.dcNo}</td>
                              <td className="py-2 px-2 text-xs">{issue.receiveName || "—"}</td>
                              <td className="py-2 px-2 font-mono text-xs">{issue.subCode || "—"}</td>
                              <td className="py-2 px-2 font-mono text-xs">{resolveToolNo(line)}</td>
                              <td className="py-2 px-2 font-mono text-xs">{line.serialNo ?? "—"}</td>
                              <td className="py-2 px-2 font-mono text-xs">{Number(line.issueQty)}</td>
                              <td className="py-2 px-2 text-xs">{resolveDesc(line)}</td>
                              <td className="py-2 px-2 font-mono text-xs">{issue.dueDate ? issue.dueDate.split("T")[0] : "—"}</td>
                              <td className="py-2 px-2 text-xs">{issue.status}</td>
                            </tr>
                          );
                        })}
                        {flatOpenLines.length === 0 && (
                          <tr>
                            <td colSpan={10} className="py-6 text-center text-xs text-[var(--text-muted)]">No records found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-center">
                  <Button type="button" variant="primary" onClick={addToReceiveList}>
                    Add To Receive List
                  </Button>
                </div>
              </div>

              {/* Receive header + list */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelCls}>Our DC No</label>
                    <input value={activeDcNo || "—"} readOnly className={`${inputCls} opacity-80`} />
                    {errors.dc && <p className="text-xs text-[var(--color-danger-text)] mt-1">{errors.dc}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>DC Date</label>
                    <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Party Name</label>
                    <select value={subCode} onChange={(e) => setSubCode(e.target.value)} className={inputCls}>
                      <option value="">-SELECT-</option>
                      {subs.map((s) => (
                        <option key={s.subCode} value={s.subCode}>{s.subCode} — {s.subName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Party DC No</label>
                    <input value={partyDcNo} onChange={(e) => setPartyDcNo(e.target.value)} className={inputCls} maxLength={15} />
                  </div>
                  <div>
                    <label className={labelCls}>From Whom</label>
                    <input value={contName} onChange={(e) => setContName(e.target.value)} className={inputCls} maxLength={80} />
                  </div>
                  <div>
                    <label className={labelCls}>Our PO No</label>
                    <input value={poOrderNo} onChange={(e) => setPoOrderNo(e.target.value)} className={inputCls} maxLength={15} />
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} maxLength={50} />
                  </div>
                  <div>
                    <label className={labelCls}>GE.No</label>
                    <input value={geNo} onChange={(e) => setGeNo(e.target.value)} className={inputCls} maxLength={20} />
                  </div>
                </div>

                {errors.lines && (
                  <p className="text-xs text-[var(--color-danger-text)] font-semibold">{errors.lines}</p>
                )}

                <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["Gauge/Tool No", "SLNo", "Qty", "Status", "Description", "Comments", ""].map((c) => (
                          <th key={c} className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {staged.map((line, idx) => (
                        <tr key={line.issueRowId}>
                          <td className="py-2 px-3 font-mono text-xs font-semibold">{line.toolOrGaugeNo}</td>
                          <td className="py-2 px-3 font-mono text-xs">{line.serialNo || "—"}</td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0.001}
                              max={line.maxQty}
                              step="any"
                              value={line.qty}
                              onChange={(e) =>
                                patchStaged(idx, {
                                  qty: Math.min(line.maxQty, Math.max(0, Number(e.target.value) || 0)),
                                })
                              }
                              className="w-20 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)] font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={line.status}
                              onChange={(e) => patchStaged(idx, { status: e.target.value })}
                              className="text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)]"
                            >
                              <option value="Received">Received</option>
                              <option value="Damaged">Damaged</option>
                              <option value="Missing">Missing</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-xs">{line.description}</td>
                          <td className="py-2 px-3">
                            <input
                              value={line.comments}
                              onChange={(e) => patchStaged(idx, { comments: e.target.value })}
                              className="w-28 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)]"
                              maxLength={30}
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setStaged((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-[var(--text-muted)] hover:text-red-600"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {staged.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setMode("list")}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={!staged.length}>
                    <ArrowDownLeft className="w-4 h-4" /> Receive
                  </Button>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
