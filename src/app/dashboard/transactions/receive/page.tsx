"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle2,
  ArrowDownLeft,
  ShieldAlert,
  Plus,
  Trash,
  Save,
  FileSpreadsheet,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { Clock } from "lucide-react";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { OverlayModal } from "@/components/ui/OverlayModal";
import { FormModalSection } from "@/components/ui/form";
import { SearchSelect, type SearchSelectItem } from "@/components/ui/SearchSelect";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { SelectionFilter } from "@/components/ui/SelectionFilter";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

export default function ReceiveToolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isMovement = pathname.startsWith("/dashboard/movement/");
  const requestedMovement = searchParams.get("movement");
  const receiveBasePath = isMovement ? "/dashboard/movement/receive" : "/dashboard/transactions/receive";
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
  const [pickerSubQuery, setPickerSubQuery] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
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
  const [geDate, setGeDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");

  const [subs, setSubs] = useState<SubOption[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ supCode: string; supName: string }>>([]);
  const [partyFilterCode, setPartyFilterCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadHistory = useCallback(
    async (
      p = page,
      q = searchQuery,
      opts?: {
        vendorType?: string;
        subFilter?: string;
        partyFilterCode?: string;
        fromDate?: string;
        toDate?: string;
      }
    ) => {
      setLoading(true);
      const vt = opts?.vendorType ?? vendorType;
      const sf = opts?.subFilter ?? subFilter;
      const pc = opts?.partyFilterCode ?? partyFilterCode;
      const fd = opts?.fromDate ?? fromDate;
      const td = opts?.toDate ?? toDate;
      const params = new URLSearchParams({
        history: "1",
        page: String(p),
        pageSize: String(pageSize),
        fromDate: fd,
        toDate: td,
        vendorType: vt,
        subCode: sf,
      });
      if (q.trim()) params.set("search", q.trim());
      if (pc.trim()) params.set("partyCode", pc.trim());
      if (isMovement) params.set("movementOnly", "1");
      if (isMovement && requestedMovement) params.set("movement", requestedMovement);
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
    [page, searchQuery, fromDate, toDate, vendorType, subFilter, partyFilterCode, isMovement, requestedMovement]
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
    if (isMovement) params.set("movementOnly", "1");
    if (isMovement && requestedMovement) params.set("movement", requestedMovement);
    const res = await apiGet<{ items: ToolsIssueHeader[] }>(`/api/receive?${params}`);
    setOpenIssues(res.data?.items ?? []);
    setOpenLoading(false);
  }, [pickerFrom, pickerTo, pickerSub, pickerSearch, isMovement, requestedMovement]);

  useEffect(() => {
    void loadHistory(1, "");
    void (async () => {
      const [subRes, supRes] = await Promise.all([
        apiGet<{ items?: SubOption[] }>("/api/subcontractors?pageSize=200"),
        apiGet<{ items?: Array<{ supCode: string; supName: string }> }>("/api/suppliers?pageSize=200"),
      ]);
      setSubs(subRes.data?.items ?? []);
      setSuppliers(supRes.data?.items ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openReceiveForm = useCallback(() => {
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
    setPickerSubQuery("");
    setPartyQuery("");
    setPickerSearch("");
    router.replace(`${receiveBasePath}?action=add`, { scroll: false });
  }, [receiveBasePath, router]);

  const closeReceiveForm = useCallback(() => {
    setMode("list");
    setStaged([]);
    setSelectedKeys(new Set());
    setErrors({});
    router.replace(receiveBasePath, { scroll: false });
  }, [receiveBasePath, router]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "add") {
      if (mode !== "receive") {
        setMode("receive");
        setReceiveDate(localToday());
      }
      return;
    }
    if (mode === "receive") {
      setMode("list");
      setStaged([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const flatOpenLines = openIssues.flatMap((issue) =>
    issue.lines.map((line) => ({ issue, line }))
  );

  const dcToolSelectItems: SearchSelectItem[] = (() => {
    const q = pickerSearch.trim().toLowerCase();
    const items: SearchSelectItem[] = [];
    const seenDc = new Set<string>();
    for (const { issue, line } of flatOpenLines) {
      if (!seenDc.has(issue.dcNo)) {
        seenDc.add(issue.dcNo);
        if (!q || issue.dcNo.toLowerCase().includes(q) || (issue.receiveName ?? "").toLowerCase().includes(q)) {
          items.push({
            id: `dc:${issue.dcNo}`,
            primary: issue.dcNo,
            secondary: `${issue.receiveName || "—"} · ${issue.subCode || "—"} · select all lines`,
          });
        }
      }
      const tool = resolveToolNo(line);
      if (!q || tool.toLowerCase().includes(q) || issue.dcNo.toLowerCase().includes(q)) {
        items.push({
          id: `line:${issue.dcNo}:${lineKey(line)}`,
          primary: tool,
          secondary: `DC ${issue.dcNo} · qty ${Number(line.issueQty) || 0} · ${resolveDesc(line)}`,
        });
      }
      if (items.length >= 40) break;
    }
    return items;
  })();

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
        toastError("Select lines from one DC only for a receive (ERP: one Our DC No per GRN).");
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
      toastError("Select one or more open issue lines first.");
      return;
    }

    setActiveDcNo(dc);
    setSubCode((prev) => prev || openIssues.find((i) => i.dcNo === dc)?.subCode || "");
    setContName((prev) => prev || openIssues.find((i) => i.dcNo === dc)?.receiveName || "");
    setStaged((prev) => [...prev, ...toAdd]);
    setSelectedKeys(new Set());
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
    if (isMovement && !location.trim()) tempErrors.location = "Destination rack / location is required";
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
      geDate: geDate || undefined,
      invoiceNo: invoiceNo || undefined,
      lines: staged.map((l) => ({
        issueRowId: l.issueRowId,
        toolOrGaugeNo: l.toolOrGaugeNo.startsWith("LINE-") ? undefined : l.toolOrGaugeNo,
        quantity: l.qty,
        status: l.status,
        comments: l.comments || undefined,
      })),
    };

    const res = await apiPost<{ ok: boolean; header?: { recNo: number } }>("/api/receive", payload);
    if (res.error) {
      toastError(res.error.message);
      return;
    }

    const grn = res.data?.header?.recNo;
    toastSuccess({
      title: isMovement ? "Movement received" : "Receive posted",
      message: isMovement ? "Instrument ownership moved to the destination unit." : "Items/Asset receive saved.",
      detail: grn ? `${isMovement ? "Receipt" : "GRN"} #${grn} · DC #${activeDcNo}` : `DC #${activeDcNo}`,
    });
    setMode("list");
    setStaged([]);
    router.replace(receiveBasePath, { scroll: false });
    void loadHistory(1, searchQuery);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageQty = history.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
  const pageLines = history.length;

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* List stays mounted under overlay */}
          <>
              <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    {isMovement ? "Receive Movement" : "Tools Issue Receive"}
                  </h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {isMovement ? "Confirm instruments received into their destination unit" : "GRN history + Items/Asset Receive (TOOLS_ISSUE_RECEIVED)"}
                  </p>
                </div>
                <RoleGate permission="canReceiveTool">
                  {mode !== "receive" && (
                    <Button type="button" variant="primary" onClick={openReceiveForm}>
                      <Plus className="w-4 h-4" /> {isMovement ? "Receive Movement" : "Receive"}
                    </Button>
                  )}
                </RoleGate>
              </div>

              <ModuleKpiRow
                items={[
                  {
                    id: "pending-returns",
                    label: isMovement ? "Pending Movements" : "Pending Return DCs",
                    value: pendingTotal,
                    subtext: isMovement ? "Awaiting destination receipt" : "Open returnable issue slips",
                    title: "Open issue DCs with RETURNABLE ≠ No awaiting receive",
                    icon: ArrowDownLeft,
                    iconBg: "bg-[var(--primary-light)]",
                    iconColor: "text-[var(--primary)]",
                    badge: { label: "Pending", type: "info" },
                  },
                  {
                    id: "overdue-returns",
                    label: isMovement ? "Overdue Movements" : "Overdue Returns",
                    value: overdueTotal,
                    subtext: "Due date before today",
                    title: "Pending return DCs with a real due date already past",
                    icon: ShieldAlert,
                    iconBg: "bg-amber-50 dark:bg-amber-950/30",
                    iconColor: "text-amber-600 dark:text-amber-400",
                    badge: { label: "Overdue", type: "warning" },
                  },
                  {
                    id: "grn-total",
                    label: isMovement ? "Completed Receipts" : "Matching GRNs",
                    value: total,
                    subtext: "Receive headers in filters",
                    title: "TOOLS_ISSUE_RECEIVED headers matching current filters",
                    icon: CheckCircle2,
                    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                    iconColor: "text-emerald-600 dark:text-emerald-400",
                    badge: { label: "GRNs", type: "success" },
                  },
                  {
                    id: "page-qty",
                    label: isMovement ? "Instruments on Page" : "Qty on This Page",
                    value: pageQty,
                    subtext: `${pageLines} line${pageLines === 1 ? "" : "s"} · page ${page}`,
                    title: "Sum of receive quantities on the current page",
                    icon: Clock,
                    iconBg: "bg-blue-50 dark:bg-blue-950/30",
                    iconColor: "text-blue-600 dark:text-blue-400",
                    badge: { label: "Page", type: "info" },
                  },
                ]}
              />

              <StatusPillTabs
                className="mb-3"
                idPrefix="receive-vendor-pill"
                value={vendorType}
                onChange={(v) => {
                  setVendorType(v);
                  setSubFilter("ALL");
                  setPartyFilterCode("");
                  setPage(1);
                  void loadHistory(1, searchQuery, {
                    vendorType: v,
                    subFilter: "ALL",
                    partyFilterCode: "",
                  });
                }}
                items={[
                  { value: "ALL", label: "All" },
                  { value: "SubContractor", label: "SubContractor" },
                  { value: "Supplier", label: "Supplier" },
                  { value: "Customer", label: "Customer" },
                ]}
              />

              <MasterTableCard
                toolbar={
                  <>
                    <MasterSearchInput
                      id="receive-search-input"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="GRN / DC / party…"
                      widthClass="w-48"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="date"
                        aria-label="From date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="h-7 text-[11px] border border-[var(--border-main)] rounded-md px-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                      />
                      <input
                        type="date"
                        aria-label="To date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="h-7 text-[11px] border border-[var(--border-main)] rounded-md px-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                      />
                      {vendorType === "Customer" ? (
                        <input
                          value={partyFilterCode}
                          onChange={(e) => setPartyFilterCode(e.target.value)}
                          placeholder="Customer code"
                          aria-label="Customer code"
                          className="h-7 w-28 shrink-0 text-[11px] font-mono border border-[var(--border-main)] rounded-md px-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                        />
                      ) : vendorType === "Supplier" ? (
                        <SelectionFilter
                          id="receive-supplier-filter"
                          label="Supplier"
                          value={partyFilterCode || "ALL"}
                          anyValue="ALL"
                          anyLabel="Any"
                          maxValueWidth="5rem"
                          onChange={(v) => {
                            setPartyFilterCode(v === "ALL" ? "" : v);
                            setSubFilter("ALL");
                          }}
                          options={[
                            { value: "ALL", label: "Any" },
                            ...suppliers.map((s) => ({
                              value: s.supCode,
                              label: `${s.supCode} — ${s.supName}`,
                            })),
                          ]}
                        />
                      ) : vendorType === "SubContractor" ? (
                        <SelectionFilter
                          id="receive-sub-filter"
                          label="Sub"
                          value={subFilter}
                          anyValue="ALL"
                          anyLabel="Any"
                          maxValueWidth="5rem"
                          onChange={setSubFilter}
                          options={[
                            { value: "ALL", label: "Any" },
                            ...subs.map((s) => ({
                              value: s.subCode,
                              label: `${s.subCode} — ${s.subName}`,
                            })),
                          ]}
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 !rounded-md !px-2 !text-[11px]"
                        onClick={() => {
                          setPage(1);
                          void loadHistory(1, searchQuery);
                        }}
                      >
                        Apply
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 !rounded-md !px-2 !text-[11px]"
                        disabled={loading || history.length === 0}
                        onClick={() => {
                          downloadExcel({
                            filename: "tools_receive",
                            sheetName: "Receive",
                            columns: [
                              { key: "grnNo", label: "GRN No" },
                              {
                                key: "receiveDate",
                                label: "GRN Date",
                                value: (r) => (r.receiveDate ? String(r.receiveDate).split("T")[0] : ""),
                              },
                              { key: "dcNo", label: "DC No" },
                              { key: "receivedFrom", label: "Received From" },
                              { key: "partyDcNo", label: "Party DC" },
                              { key: "toolOrGaugeNo", label: "Tool No" },
                              { key: "qty", label: "Qty" },
                              { key: "status", label: "Status" },
                              { key: "vendorType", label: "Vendor Type" },
                            ],
                            rows: history,
                          });
                          toastSuccess("Excel downloaded (current page).");
                        }}
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        Excel
                      </Button>
                    </div>
                  </>
                }
                footer={
                  total > pageSize ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-[var(--text-muted)]">
                        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} out of {total}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 !rounded-md !px-2 !text-[11px]"
                          disabled={page <= 1 || loading}
                          onClick={() => {
                            const n = page - 1;
                            setPage(n);
                            void loadHistory(n, searchQuery);
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 !rounded-md !px-2 !text-[11px]"
                          disabled={page >= totalPages || loading}
                          onClick={() => {
                            const n = page + 1;
                            setPage(n);
                            void loadHistory(n, searchQuery);
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : undefined
                }
              >
                {loading ? (
                  <div className="p-4">
                    <TableSkeleton rows={5} />
                  </div>
                ) : (
                  <div className="overflow-auto">
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
                  </div>
                )}
              </MasterTableCard>
          </>

          {mode === "receive" && (
            <OverlayModal
              open
              size="5xl"
              title={isMovement ? "Receive Movement" : "Add Receive"}
              subtitle={isMovement ? "Confirm arrival at the destination unit" : "Items / Asset Receive · GRN Auto"}
              onClose={closeReceiveForm}
              footer={
                <>
                  <button type="button" onClick={closeReceiveForm} className="form-btn-cancel">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="receive-create-form"
                    className="form-btn-save"
                    disabled={!staged.length}
                  >
                    <Save className="w-4 h-4" /> Save Now
                  </button>
                </>
              }
            >
              <form id="receive-create-form" onSubmit={handleConfirmReceive} className="space-y-0">
                <FormModalSection title={isMovement ? "Select pending movement" : "Open DC picker"}>
                  <div className="form-grid">
                    <div>
                      <label className="form-label">{isMovement ? "Receipt No." : "GRN No"}</label>
                      <input value="Auto" readOnly className="form-control opacity-70" />
                    </div>
                    <div>
                      <label className="form-label">Rec.Date</label>
                      <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className="form-control" />
                      {errors.receiveDate && <p className="form-error">{errors.receiveDate}</p>}
                    </div>
                    <div>
                      <label className="form-label">From</label>
                      <input type="date" value={pickerFrom} onChange={(e) => setPickerFrom(e.target.value)} className="form-control" />
                    </div>
                    <div>
                      <label className="form-label">To</label>
                      <input type="date" value={pickerTo} onChange={(e) => setPickerTo(e.target.value)} className="form-control" />
                    </div>
                  </div>

                  <div className="form-grid">
                    <SearchSelect
                      label="Sub Contractor"
                      placeholder="Search subcontractor…"
                      query={pickerSubQuery}
                      onQueryChange={setPickerSubQuery}
                      selected={
                        pickerSub !== "ALL"
                          ? {
                              primary: pickerSub,
                              secondary: subs.find((s) => s.subCode === pickerSub)?.subName,
                            }
                          : null
                      }
                      onClear={() => {
                        setPickerSub("ALL");
                        setPickerSubQuery("");
                      }}
                      items={[
                        { id: "ALL", primary: "ALL", secondary: "All subcontractors" },
                        ...subs
                          .filter((s) => {
                            const q = pickerSubQuery.trim().toLowerCase();
                            return (
                              !q ||
                              s.subCode.toLowerCase().includes(q) ||
                              (s.subName ?? "").toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 50)
                          .map((s) => ({
                            id: s.subCode,
                            primary: s.subCode,
                            secondary: s.subName,
                          })),
                      ]}
                      onSelect={(item) => {
                        setPickerSub(item.id);
                        setPickerSubQuery("");
                      }}
                      emptyText="No subcontractors match"
                    />
                    <SearchSelect
                      label="Open DC / Tool"
                      placeholder="Search DC or tool number…"
                      query={pickerSearch}
                      onQueryChange={setPickerSearch}
                      items={dcToolSelectItems}
                      onSelect={(item) => {
                        // Select matching open lines (checkbox) for quick add
                        const next = new Set(selectedKeys);
                        for (const { issue, line } of flatOpenLines) {
                          const key = `${issue.dcNo}:${lineKey(line)}`;
                          const tool = resolveToolNo(line).toLowerCase();
                          if (
                            item.id.startsWith("dc:") &&
                            issue.dcNo === item.id.slice(3)
                          ) {
                            next.add(key);
                          } else if (
                            item.id.startsWith("line:") &&
                            key === item.id.slice(5)
                          ) {
                            next.add(key);
                          } else if (
                            !item.id.startsWith("dc:") &&
                            !item.id.startsWith("line:") &&
                            (issue.dcNo === item.primary || tool.includes(item.primary.toLowerCase()))
                          ) {
                            next.add(key);
                          }
                        }
                        setSelectedKeys(next);
                        setPickerSearch("");
                      }}
                      loading={openLoading}
                      emptyText="No open DC / tool matches — adjust filters and Search"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => void loadOpenIssues()}>
                      Search
                    </Button>
                    <Button type="button" variant="primary" onClick={addToReceiveList}>
                      Add To Receive List
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
                </FormModalSection>

                <FormModalSection title="Receive details">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Our DC No</label>
                      <input value={activeDcNo || "—"} readOnly className="form-control opacity-80" />
                      {errors.dc && <p className="form-error">{errors.dc}</p>}
                    </div>
                    <div>
                      <label className="form-label">DC Date</label>
                      <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className="form-control" />
                    </div>
                    <SearchSelect
                      label="Party Name"
                      placeholder="Search party / subcontractor…"
                      query={partyQuery}
                      onQueryChange={setPartyQuery}
                      selected={
                        subCode
                          ? {
                              primary: subCode,
                              secondary: subs.find((s) => s.subCode === subCode)?.subName,
                            }
                          : null
                      }
                      onClear={() => {
                        setSubCode("");
                        setPartyQuery("");
                      }}
                      items={subs
                        .filter((s) => {
                          const q = partyQuery.trim().toLowerCase();
                          return (
                            !q ||
                            s.subCode.toLowerCase().includes(q) ||
                            (s.subName ?? "").toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 50)
                        .map((s) => ({
                          id: s.subCode,
                          primary: s.subCode,
                          secondary: s.subName,
                        }))}
                      onSelect={(item) => {
                        setSubCode(item.id);
                        setPartyQuery("");
                      }}
                      emptyText="No parties match"
                    />
                    <div>
                      <label className="form-label">Party DC No</label>
                      <input value={partyDcNo} onChange={(e) => setPartyDcNo(e.target.value)} className="form-control" maxLength={15} />
                    </div>
                    <div>
                      <label className="form-label">From Whom</label>
                      <input value={contName} onChange={(e) => setContName(e.target.value)} className="form-control" maxLength={80} />
                    </div>
                    <div>
                      <label className="form-label">Our PO No</label>
                      <input value={poOrderNo} onChange={(e) => setPoOrderNo(e.target.value)} className="form-control" maxLength={15} />
                    </div>
                    <div>
                      <label className="form-label">{isMovement ? "Destination Rack / Location *" : "Location"}</label>
                      <input
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          setErrors((previous) => ({ ...previous, location: "" }));
                        }}
                        className="form-control"
                        maxLength={50}
                        placeholder={isMovement ? "Rack or storage location in destination unit" : undefined}
                      />
                      {errors.location && <p className="form-error">{errors.location}</p>}
                    </div>
                    <div>
                      <label className="form-label">GE.No</label>
                      <input value={geNo} onChange={(e) => setGeNo(e.target.value)} className="form-control" maxLength={20} />
                    </div>
                    <div>
                      <label className="form-label">GE.Date</label>
                      <input type="date" value={geDate} onChange={(e) => setGeDate(e.target.value)} className="form-control" />
                    </div>
                    <div>
                      <label className="form-label">Invoice No</label>
                      <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="form-control" maxLength={25} />
                    </div>
                  </div>

                  {errors.lines && (
                    <p className="form-error">{errors.lines}</p>
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
                                className="w-20 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)] font-mono"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={line.status}
                                onChange={(e) => patchStaged(idx, { status: e.target.value })}
                                className="text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)]"
                              >
                                <option value="Received">Received</option>
                                <option value="Damaged">Damaged</option>
                                <option value="Missing">Missing</option>
                                <option value="WORN OUT">WORN OUT</option>
                                <option value="BROKEN">BROKEN</option>
                                <option value="REJECTED">REJECTED</option>
                                <option value="AVAILABLE FOR USE">AVAILABLE FOR USE</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-xs">{line.description}</td>
                            <td className="py-2 px-3">
                              <input
                                value={line.comments}
                                onChange={(e) => patchStaged(idx, { comments: e.target.value })}
                                className="w-28 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)]"
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
                </FormModalSection>
              </form>
            </OverlayModal>
          )}
        </main>
      </div>
    </div>
  );
}
