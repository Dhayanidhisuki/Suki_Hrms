"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash, Save, FileSpreadsheet } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { FileText, Clock, PackageCheck, AlertCircle } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { OverlayModal } from "@/components/ui/OverlayModal";
import { FormModalSection } from "@/components/ui/form";
import { SearchSelect, type SearchSelectItem } from "@/components/ui/SearchSelect";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";
import { useRouter, useSearchParams } from "next/navigation";

// ERP uses "Active" for open DCs, "Cancelled"/"Closed" for closed DCs
type IssueStatus = "OPEN" | "CLOSED" | "PARTIAL" | "Active" | "Closed" | "Cancelled";

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
  issueEmpName?: string | null;
  machine?: string | null;
  status?: string | null;
  toolRefNo?: number | null;
  tool?: ToolMasterPreview | null;
  toolByRef?: ToolMasterPreview | null;
}

interface ToolsIssueHeader {
  dcNo: string;
  receiveName: string | null;
  receiveNameTwo?: string | null;
  subCode: string | null;
  supCode?: string | null;
  custCode?: string | null;
  empId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  issueOption?: string | null;
  transportName?: string | null;
  vehicleNo?: string | null;
  comments?: string | null;
  lobType?: string | null;
  poOrderNo?: string | null;
  fromUnit?: string | null;
  issuePurpose?: string | null;
  matType?: string | null;
  returnable?: string | null;
  status: IssueStatus;
  creatUserIdCd: string;
  creatDt: string;
  lines: ToolsIssueLine[];
}

interface Tool {
  refNo: number;
  toolOrGaugeNo: string;
  name: string;
  grouping: string;
  type?: string | null;
  qtyIn: number;
  totQty?: number;
  location?: string | null;
  returnable?: string | null;
  serialNoGenReq?: string | null;
  status: string;
  machines?: string[];
}

interface SubOption {
  id: string;
  subCode: string;
  subName: string;
}

interface SupOption {
  id: string;
  supCode: string;
  supName: string;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]" },
  // ERP uses 'Active' for open issue DCs
  Active: { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]" },
  CLOSED: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  Closed: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  Cancelled: { bg: "bg-[var(--bg-subtle)] border border-[var(--border-main)]", text: "text-[var(--text-muted)]" },
  PARTIAL: { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
};

interface StagedLine {
  toolOrGaugeNo: string;
  toolName: string;
  description: string;
  grouping: string;
  type: string;
  issueQty: number;
  qtyAvailable: number;
  totQty: number;
  location: string;
  returnable: string;
  serialNo: string;
  machine: string;
  processName: string;
  partNo: string;
  price: number;
  maintainsSerial: boolean;
  machineOptions: string[];
}

const ISSUE_OPTIONS = [
  "SubContractor",
  "Supplier",
  "Customer",
  "Inhouse or SubContractor",
  "Issue to Supplier",
] as const;

const LOB_TYPES = ["AUTOMOTIVE", "ALL", "OTHERS"] as const;

const inputCls = "form-control";
const labelCls = "form-label";

/** Compact controls for the ERP issue header card */
const headerInputCls = "form-control h-10";
const headerLabelCls = "form-label";
const headerFieldCls = "min-w-0";
const headerErrCls = "form-error";

function toolMaintainsSerial(flag: string | null | undefined): boolean {
  const v = (flag ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "1" || v === "true";
}

/** YYYY-MM-DD in the user's local timezone (avoids UTC off-by-one). */
function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function IssueToolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // List state
  const [issues, setIssues] = useState<ToolsIssueHeader[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Pagination + search + status tabs
  const [searchQuery, setSearchQuery] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState<"All" | "Open" | "Closed" | "Overdue">("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  // Form Header State (ERP Tools Issue fields)
  const [receiveName, setReceiveName] = useState("");
  const [receiveNameTwo, setReceiveNameTwo] = useState("");
  const [subCode, setSubCode] = useState("");
  const [supCode, setSupCode] = useState("");
  const [custCode, setCustCode] = useState("");
  const [empId, setEmpId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [issueOption, setIssueOption] = useState<string>("SubContractor");
  const [dcRefNo, setDcRefNo] = useState("");
  const [returnable, setReturnable] = useState<"Yes" | "No">("Yes");
  const [transportName, setTransportName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [comments, setComments] = useState("");
  const [lobType, setLobType] = useState<string>("AUTOMOTIVE");
  const [poOrderNo, setPoOrderNo] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [issuePurpose, setIssuePurpose] = useState("");
  const [matType, setMatType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editIssue, setEditIssue] = useState<ToolsIssueHeader | null>(null);
  const [subs, setSubs] = useState<SubOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupOption[]>([]);

  // Staged lines
  const [stagedLines, setStagedLines] = useState<StagedLine[]>([]);

  // Search/Dropdown selection state
  const [searchVal, setSearchVal] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [toolSearching, setToolSearching] = useState(false);

  // Validation Error State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Default both dates to today (local) so Return Due Date isn't left blank
    const today = localToday();
    setIssueDate(today);
    setDueDate(today);
  }, [showCreate]);

  useEffect(() => {
    if (!showCreate) return;
    void (async () => {
      const [subRes, supRes] = await Promise.all([
        apiGet<{ items?: SubOption[] }>("/api/subcontractors?pageSize=200"),
        apiGet<{ items?: SupOption[] }>("/api/suppliers?pageSize=200"),
      ]);
      setSubs(subRes.data?.items ?? []);
      setSuppliers(supRes.data?.items ?? []);
    })();
  }, [showCreate]);

  const loadIssues = useCallback(async (
    p = page,
    q = searchQuery,
    status = listStatusFilter,
    from = fromDate,
    to = toDate
  ) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (q) params.set("search", q);
    if (status && status !== "All") params.set("status", status);
    if (from) params.set("fromDate", from);
    if (to) params.set("toDate", to);
    const res = await apiGet<{ items: ToolsIssueHeader[]; total: number }>(`/api/issue?${params}`);
    if (res.data?.items) setIssues(res.data.items);
    if (res.data?.total !== undefined) setTotal(res.data.total);
    setLoading(false);
  }, [page, searchQuery, listStatusFilter, fromDate, toDate]);

  // Debounced search handler
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadIssues(1, val, listStatusFilter), 400);
  };

  const handleStatusTabChange = (status: "All" | "Open" | "Closed" | "Overdue") => {
    setListStatusFilter(status);
    setPage(1);
    void loadIssues(1, searchQuery, status);
  };

  // Tool search: on-demand via debounce (NOT pre-loaded on mount)
  const toolSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zeroStockHints, setZeroStockHints] = useState<Tool[]>([]);
  const fetchToolsForSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setTools([]);
      setZeroStockHints([]);
      setToolSearching(false);
      return;
    }
    setToolSearching(true);
    try {
      // Prefer in-stock tools. If none, show zero-stock matches as disabled hints.
      const inStock = await apiGet<{ items: Tool[] }>(
        `/api/tools?search=${encodeURIComponent(q)}&pageSize=15&availableOnly=1`
      );
      const stocked = (inStock.data?.items ?? []).filter((t) => Number(t.qtyIn ?? 0) > 0);
      setTools(stocked);
      if (stocked.length > 0) {
        setZeroStockHints([]);
        return;
      }
      const any = await apiGet<{ items: Tool[] }>(
        `/api/tools?search=${encodeURIComponent(q)}&pageSize=8`
      );
      setZeroStockHints(
        (any.data?.items ?? []).filter((t) => Number(t.qtyIn ?? 0) <= 0).slice(0, 6)
      );
    } finally {
      setToolSearching(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
    // No loadTools() here — tools fetched on demand when user types in search
  }, []);

  // Re-fetch when page changes (but NOT on first render, handled above)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    loadIssues(page, searchQuery, listStatusFilter);
  }, [page]);

  // API already filters availableOnly; keep a client safety filter on qtyIn
  const queryLower = searchVal.toLowerCase().trim();
  const searchResults = tools.filter((t) => {
    if (!queryLower) return false;
    const matches =
      t.name?.toLowerCase().includes(queryLower) ||
      t.toolOrGaugeNo.toLowerCase().includes(queryLower);
    return matches && Number(t.qtyIn ?? 0) > 0;
  });

  const getAvailableStock = (toolNo: string) => {
    const found = tools.find((t) => t.toolOrGaugeNo === toolNo);
    const inStock = found ? found.qtyIn : 0;
    const alreadyStaged = stagedLines
      .filter((l) => l.toolOrGaugeNo === toolNo)
      .reduce((sum, l) => sum + l.issueQty, 0);
    return Math.max(0, inStock - alreadyStaged);
  };

  const partySelectItems: SearchSelectItem[] = (() => {
    const q = partyQuery.trim().toLowerCase();
    if (issueOption === "Customer") {
      return custCode.trim()
        ? [{ id: custCode.trim(), primary: custCode.trim(), secondary: "Customer code" }]
        : [];
    }
    if (issueOption === "Supplier" || issueOption === "Issue to Supplier") {
      return suppliers
        .filter(
          (s) =>
            !q ||
            s.supCode.toLowerCase().includes(q) ||
            (s.supName ?? "").toLowerCase().includes(q)
        )
        .slice(0, 50)
        .map((s) => ({
          id: s.supCode,
          primary: s.supCode,
          secondary: s.supName,
        }));
    }
    return subs
      .filter(
        (s) =>
          !q ||
          s.subCode.toLowerCase().includes(q) ||
          (s.subName ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50)
      .map((s) => ({
        id: s.subCode,
        primary: s.subCode,
        secondary: s.subName,
      }));
  })();

  const toolSelectItems: SearchSelectItem[] = [
    ...searchResults.map((t) => ({
      id: String(t.refNo),
      primary: t.toolOrGaugeNo,
      secondary:
        !t.name || t.name.trim().toUpperCase() === "N/A"
          ? t.grouping
          : `${t.name}${toolMaintainsSerial(t.serialNoGenReq) ? " · Serial tracked" : ""}`,
      right: (
        <span className="text-[10px] font-bold text-[var(--color-success-text)] font-mono bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full border border-[var(--border-main)]">
          {getAvailableStock(t.toolOrGaugeNo)} in-stock
        </span>
      ),
    })),
    ...zeroStockHints.map((t) => ({
      id: `zero-${t.refNo}`,
      primary: t.toolOrGaugeNo,
      secondary: t.name || t.grouping,
      disabled: true,
      right: (
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          0 stock
        </span>
      ),
    })),
  ];

  const handleSelectTool = (tool: Tool) => {
    const toolNo = tool.toolOrGaugeNo;
    const currentAvail = getAvailableStock(toolNo);
    const serialTracked = toolMaintainsSerial(tool.serialNoGenReq);
    if (!serialTracked && currentAvail <= 0) return;

    const existingIdx = stagedLines.findIndex((l) => l.toolOrGaugeNo === toolNo);
    if (existingIdx >= 0) {
      const updated = [...stagedLines];
      if (!serialTracked) {
        updated[existingIdx].issueQty = Math.min(
          updated[existingIdx].issueQty + 1,
          Math.max(1, updated[existingIdx].qtyAvailable)
        );
      }
      setStagedLines(updated);
    } else {
      const displayName =
        !tool.name || tool.name.trim().toUpperCase() === "N/A" ? toolNo : tool.name;
      setStagedLines((prev) => [
        ...prev,
        {
          toolOrGaugeNo: toolNo,
          toolName: displayName,
          description: tool.name || "",
          grouping: tool.grouping || "",
          type: tool.type || "",
          issueQty: 1,
          qtyAvailable: Number(tool.qtyIn ?? 0),
          totQty: Number(tool.totQty ?? tool.qtyIn ?? 0),
          location: tool.location || "",
          returnable: tool.returnable === "No" ? "No" : returnable,
          serialNo: "",
          machine: tool.machines?.[0] || "",
          processName: "",
          partNo: toolNo,
          price: 0,
          maintainsSerial: serialTracked,
          machineOptions: tool.machines ?? [],
        },
      ]);
    }
    setSearchVal("");
    setFormErrors((prev) => ({ ...prev, lines: "" }));
  };

  const patchLine = (index: number, patch: Partial<StagedLine>) => {
    setStagedLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const updated = [...stagedLines];
    const line = updated[index];
    const maxVal = line.maintainsSerial ? 9999 : line.qtyAvailable;
    const raw = Number.isFinite(newQty) ? newQty : 1;
    if (!line.maintainsSerial && raw > maxVal) {
      setFormErrors((prev) => ({
        ...prev,
        lines: `Only ${maxVal} available for ${line.toolOrGaugeNo}. Raise Qty In on Item/Asset Master to issue more.`,
      }));
    } else {
      setFormErrors((prev) => ({ ...prev, lines: "" }));
    }
    updated[index].issueQty = Math.min(Math.max(1, raw), Math.max(1, maxVal));
    setStagedLines(updated);
  };

  const bumpQty = (index: number, delta: number) => {
    const line = stagedLines[index];
    if (!line) return;
    handleUpdateQty(index, line.issueQty + delta);
  };

  const handleRemoveLine = (index: number) => {
    setStagedLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearForm = () => {
    setReceiveName("");
    setReceiveNameTwo("");
    setSubCode("");
    setSupCode("");
    setCustCode("");
    setEmpId("");
    const today = localToday();
    setIssueDate(today);
    setDueDate(today);
    setIssueOption("SubContractor");
    setDcRefNo("");
    setReturnable("Yes");
    setTransportName("");
    setVehicleNo("");
    setComments("");
    setLobType("AUTOMOTIVE");
    setPoOrderNo("");
    setFromUnit("");
    setIssuePurpose("");
    setMatType("");
    setStagedLines([]);
    setFormErrors({});
    setPartyQuery("");
    setSearchVal("");
    setTools([]);
    setZeroStockHints([]);
  };

  const isOpenIssue = (status: string | null | undefined) =>
    ["Active", "OPEN", "Open", "PARTIAL"].includes(status ?? "");

  const handleCancelIssue = async (dcNo: string) => {
    if (!confirm(`Cancel open DC ${dcNo}? Stock will be restored for non-serial tools.`)) return;
    const res = await apiDelete(`/api/issue/${encodeURIComponent(dcNo)}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess(`DC ${dcNo} cancelled.`);
    void loadIssues();
  };

  const openEditIssue = (issue: ToolsIssueHeader) => {
    setEditIssue(issue);
    setReceiveName(issue.receiveName ?? "");
    setReceiveNameTwo(issue.receiveNameTwo ?? "");
    setSubCode(issue.subCode ?? "");
    setSupCode(issue.supCode ?? "");
    setCustCode(issue.custCode ?? "");
    setIssueOption(issue.issueOption || "SubContractor");
    setDueDate(issue.dueDate ? String(issue.dueDate).split("T")[0] : localToday());
    setTransportName(issue.transportName ?? "");
    setVehicleNo(issue.vehicleNo ?? "");
    setComments(issue.comments ?? "");
    setLobType(issue.lobType || "AUTOMOTIVE");
    setPoOrderNo(issue.poOrderNo ?? "");
    setFromUnit(issue.fromUnit ?? "");
    setIssuePurpose(issue.issuePurpose ?? "");
    setMatType(issue.matType ?? "");
    setReturnable(issue.returnable === "No" ? "No" : "Yes");
    setFormErrors({});
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editIssue) return;
    if (issueOption === "Customer" && !custCode.trim()) {
      setFormErrors({ party: "Enter Customer Code" });
      return;
    }
    const res = await apiPut(`/api/issue/${encodeURIComponent(editIssue.dcNo)}`, {
      receiveName: receiveName.trim(),
      receiveNameTwo: receiveNameTwo || null,
      subCode: issueOption === "Customer" ? null : subCode || null,
      supCode:
        issueOption === "Supplier" || issueOption === "Issue to Supplier" ? supCode || null : null,
      custCode: issueOption === "Customer" ? custCode.trim() : null,
      dueDate,
      issueOption,
      returnable,
      transportName: transportName || null,
      vehicleNo: vehicleNo || null,
      comments: comments || null,
      lobType,
      poOrderNo: poOrderNo || null,
      fromUnit: fromUnit || null,
      issuePurpose: issuePurpose || null,
      matType: matType || null,
    });
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess(`DC ${editIssue.dcNo} updated.`);
    setEditIssue(null);
    handleClearForm();
    void loadIssues();
  };

  const handleExportExcel = () => {
    downloadExcel({
      filename: "tools_issue",
      sheetName: "Issues",
      columns: [
        { key: "dcNo", label: "DC No" },
        { key: "issueDate", label: "Issue Date", value: (r) => (r.issueDate ? String(r.issueDate).split("T")[0] : "") },
        { key: "dueDate", label: "Due Date", value: (r) => (r.dueDate ? String(r.dueDate).split("T")[0] : "") },
        { key: "receiveName", label: "Issued To" },
        { key: "issueOption", label: "Search By" },
        { key: "subCode", label: "Sub Code" },
        { key: "supCode", label: "Sup Code" },
        { key: "custCode", label: "Cust Code" },
        { key: "status", label: "Status" },
        { key: "lines", label: "Lines", value: (r) => r.lines?.length ?? 0 },
      ],
      rows: issues,
    });
    toastSuccess("Excel downloaded (current page).");
  };

  const openCreate = useCallback(() => {
    setShowCreate(true);
    router.replace("/dashboard/transactions/issue?action=add", { scroll: false });
  }, [router]);

  const closeCreate = useCallback(() => {
    handleClearForm();
    setShowCreate(false);
    router.replace("/dashboard/transactions/issue", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "add") {
      if (!showCreate) setShowCreate(true);
      return;
    }
    if (showCreate) {
      setShowCreate(false);
      handleClearForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!receiveName.trim()) errors.receiveName = "Receiver Name 1 is required";
    if (!dueDate) errors.dueDate = "Return due date is required";
    if (!lobType || lobType === "-Select-") errors.lobType = "LOB Type is required";
    if (issueOption === "SubContractor" && !subCode.trim()) {
      errors.party = "Select Party Name (SubContractor)";
    }
    if ((issueOption === "Supplier" || issueOption === "Issue to Supplier") && !supCode.trim()) {
      errors.party = "Select Party Name (Supplier)";
    }
    if (issueOption === "Customer" && !custCode.trim()) {
      errors.party = "Enter Customer Code";
    }
    if (stagedLines.length === 0) errors.lines = "At least one tool line item must be added to issue slip";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const empParsed = empId.trim() ? Number(empId) : 0;
    const payload = {
      receiveName,
      receiveNameTwo: receiveNameTwo || undefined,
      subCode: issueOption === "Customer" ? undefined : subCode || undefined,
      supCode:
        issueOption === "Supplier" || issueOption === "Issue to Supplier"
          ? supCode || undefined
          : undefined,
      custCode: issueOption === "Customer" ? custCode.trim() : undefined,
      empId: Number.isFinite(empParsed) ? empParsed : 0,
      issueDate,
      dueDate,
      issueOption,
      dcRefNo: dcRefNo || undefined,
      returnable,
      transportName: transportName || undefined,
      vehicleNo: vehicleNo || undefined,
      comments: comments || undefined,
      lobType,
      poOrderNo: poOrderNo || undefined,
      fromUnit: fromUnit || undefined,
      issuePurpose: issuePurpose || undefined,
      matType: matType || undefined,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        issueQty: l.issueQty,
        partNo: l.partNo || l.toolOrGaugeNo,
        machine: l.machine || undefined,
        processName: l.processName || undefined,
        serialNo: l.serialNo.trim() ? Number(l.serialNo) : undefined,
        returnable: l.returnable,
        price: l.price > 0 ? l.price : undefined,
      })),
    };

    const res = await apiPost<{ issue: ToolsIssueHeader }>("/api/issue", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    if (res.data?.issue) {
      toastSuccess({
        title: "Issue DC created",
        message: `Tools issued successfully to ${receiveName}.`,
        detail: `DC #${res.data.issue.dcNo}`,
      });
      handleClearForm();
      setShowCreate(false);
      router.replace("/dashboard/transactions/issue", { scroll: false });
      loadIssues(1, searchQuery, listStatusFilter);
      setPage(1);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Tools Issue
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Issue tools/gauges to department or employee (GAUGE_TOOLS_ISSUE)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportExcel}
                disabled={loading || issues.length === 0}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </Button>
              <RoleGate permission="canCreateIssue">
                {!showCreate && (
                  <Button
                    id="issue-create-btn"
                    onClick={openCreate}
                    variant="primary"
                    className="group"
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                    New Issue (DC)
                  </Button>
                )}
              </RoleGate>
            </div>
          </div>

          {/* ── Module KPI Cards ── */}
          <ModuleKpiRow
            items={[
              {
                id: "total-dc-slips",
                label: "Total Issue Slips",
                value: total,
                subtext: "DC vouchers generated",
                icon: FileText,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "DC Slips", type: "info" },
              },
              {
                id: "open-slips",
                label: "Active Open Slips",
                value: issues.filter((i) => i.status === "OPEN" || i.status === "Active").length,
                subtext: "Tools currently out on DC",
                icon: Clock,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Open", type: "info" },
              },
              {
                id: "closed-slips",
                label: "Closed Returns",
                value: issues.filter((i) => i.status === "CLOSED" || i.status === "Closed").length,
                subtext: "Fully returned vouchers",
                icon: PackageCheck,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Closed", type: "success" },
              },
              {
                id: "overdue-slips",
                label: "Overdue Pending",
                value: issues.filter((i) => (i.status === "OPEN" || i.status === "Active") && i.dueDate && new Date(i.dueDate) < new Date()).length,
                subtext: "Past return due date",
                icon: AlertCircle,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                badge: { label: "Overdue", type: "warning" },
              },
            ]}
          />

          {/* ── Issue list (stays mounted under overlay) ── */}
            <StatusPillTabs
              className="mb-3"
              idPrefix="issue-status-pill"
              value={listStatusFilter}
              onChange={handleStatusTabChange}
              items={[
                { value: "All", label: "All", count: total },
                {
                  value: "Open",
                  label: "Open",
                  count: issues.filter((i) => i.status === "OPEN" || i.status === "Active").length,
                },
                {
                  value: "Closed",
                  label: "Closed",
                  count: issues.filter((i) => i.status === "CLOSED" || i.status === "Closed").length,
                },
                {
                  value: "Overdue",
                  label: "Overdue",
                  count: issues.filter(
                    (i) =>
                      (i.status === "OPEN" || i.status === "Active") &&
                      i.dueDate &&
                      new Date(i.dueDate) < new Date()
                  ).length,
                },
              ]}
            />

            <MasterTableCard
              toolbar={
                <>
                  <MasterSearchInput
                    id="issue-search-input"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search DC, party…"
                    widthClass="w-52"
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 !rounded-md !px-2 !text-[11px]"
                      onClick={() => {
                        setPage(1);
                        void loadIssues(1, searchQuery, listStatusFilter, fromDate, toDate);
                      }}
                    >
                      Apply
                    </Button>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium whitespace-nowrap pl-1">
                      {loading ? "Loading…" : `${issues.length} of ${total.toLocaleString()}`}
                    </span>
                  </div>
                </>
              }
              footer={
                total > pageSize ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-muted)]">
                      Page {page} of {Math.ceil(total / pageSize).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        id="issue-prev-page"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        ← Prev
                      </button>
                      <button
                        id="issue-next-page"
                        disabled={page >= Math.ceil(total / pageSize)}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                ) : undefined
              }
            >
              {loading ? (
                <div className="p-4">
                  <TableSkeleton rows={3} />
                </div>
              ) : issues.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--text-muted)]">
                  {searchQuery || listStatusFilter !== "All"
                    ? `No ${listStatusFilter === "All" ? "" : listStatusFilter.toLowerCase() + " "}records found${searchQuery ? ` for "${searchQuery}"` : ""}.`
                    : "No issue records found. Create a new issue to get started."}
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-main)]">
                  {issues.map((issue) => {
                    const sc = statusConfig[issue.status] ?? statusConfig["OPEN"];
                    return (
                      <div key={issue.dcNo} className="p-4">
                        <div className="flex items-center justify-between mb-3 gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{issue.dcNo}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {issue.receiveName ?? "—"} · Issued {issue.issueDate ? issue.issueDate.split("T")[0] : "—"} · Due {issue.dueDate ? issue.dueDate.split("T")[0] : "—"}
                              {issue.custCode ? ` · Cust ${issue.custCode}` : ""}
                              {issue.supCode ? ` · Sup ${issue.supCode}` : ""}
                              {issue.subCode ? ` · Sub ${issue.subCode}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <RoleGate permission="canCreateIssue">
                              {isOpenIssue(issue.status) && (
                                <>
                                  <Button type="button" size="sm" variant="outline" onClick={() => openEditIssue(issue)}>
                                    Edit
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => void handleCancelIssue(issue.dcNo)}>
                                    Cancel DC
                                  </Button>
                                </>
                              )}
                            </RoleGate>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                            >
                              {issue.status}
                            </span>
                          </div>
                        </div>
                        <div className="overflow-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                                {["Tool / Item No", "Name & Description", "Type / Group", "S.No", "Qty", "UOM", "Issued To"].map(
                                  (col) => (
                                    <th
                                      key={col}
                                      className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4"
                                    >
                                      {col}
                                    </th>
                                  )
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-main)]">
                              {issue.lines.map((line) => {
                                const master = line.tool ?? line.toolByRef;
                                const itemNo =
                                  line.toolOrGaugeNo || master?.toolOrGaugeNo || line.issueToItemNo || line.partNo;
                                const lineName = line.name || master?.name || "";
                                const lineDesc = line.description || master?.description || "";
                                const lineType = line.type || master?.type;
                                const lineGroup = line.groupName || master?.grouping;
                                return (
                                  <tr key={line.rowId} className="hover:bg-[var(--bg-hover)] transition-colors">
                                    <td className="py-3 px-4 align-middle font-mono text-xs text-[var(--text-primary)] font-semibold">
                                      {itemNo || "—"}
                                    </td>
                                    <td className="py-3 px-4 align-middle max-w-md">
                                      <p className="text-[var(--text-primary)] font-medium truncate">
                                        {lineName && lineName.trim().toUpperCase() !== "N/A" ? lineName : lineDesc || "—"}
                                      </p>
                                      {lineName && lineName.trim().toUpperCase() !== "N/A" && lineDesc && (
                                        <p className="text-[11px] text-[var(--text-muted)] truncate">{lineDesc}</p>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 align-middle text-xs text-[var(--text-secondary)]">
                                      {lineType || lineGroup ? (
                                        <>
                                          <span>{lineType || "—"}</span>
                                          {lineGroup && (
                                            <span className="block text-[11px] text-[var(--text-muted)]">{lineGroup}</span>
                                          )}
                                        </>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="py-3 px-4 align-middle font-mono text-xs text-[var(--text-secondary)]">
                                      {line.serialNo ?? "—"}
                                    </td>
                                    <td className="py-3 px-4 align-middle text-[var(--text-primary)] font-mono text-xs font-semibold">
                                      {Number(line.issueQty) || 0}
                                    </td>
                                    <td className="py-3 px-4 align-middle text-xs text-[var(--text-secondary)]">
                                      {line.uom || master?.uom || "Nos"}
                                    </td>
                                    <td className="py-3 px-4 align-middle text-xs text-[var(--text-secondary)]">
                                      {line.issueEmpName || line.machine || issue.receiveName || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </MasterTableCard>
          {showCreate && (
            <OverlayModal
              open
              size="5xl"
              title="Add Issue"
              subtitle="Issue tools / gauges · DC No Auto"
              onClose={closeCreate}
              footer={
                <>
                  <button type="button" onClick={closeCreate} className="form-btn-cancel">
                    Cancel
                  </button>
                  <button type="button" onClick={handleClearForm} className="form-btn-cancel">
                    Clear Form
                  </button>
                  <button type="submit" form="issue-create-form" id="submit-issue-btn" className="form-btn-save">
                    <Save className="w-4 h-4" /> Save Now
                  </button>
                </>
              }
            >
              <form id="issue-create-form" onSubmit={handleSubmit} className="space-y-0">
                <FormModalSection title="Who and what">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">DC Date</label>
                      <input type="date" value={issueDate} readOnly className="form-control cursor-not-allowed opacity-80" />
                    </div>
                    <div>
                      <label className="form-label">Search By</label>
                      <select
                        value={issueOption}
                        onChange={(e) => {
                          setIssueOption(e.target.value);
                          setSubCode("");
                          setSupCode("");
                          setCustCode("");
                          setPartyQuery("");
                        }}
                        className="form-control"
                      >
                        {ISSUE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    {issueOption === "Customer" ? (
                      <div>
                        <label className="form-label">Customer Code *</label>
                        <input
                          value={custCode}
                          onChange={(e) => {
                            setCustCode(e.target.value.toUpperCase());
                            setFormErrors((prev) => ({ ...prev, party: "" }));
                          }}
                          className="form-control font-mono uppercase"
                          placeholder="Enter customer code"
                          maxLength={12}
                        />
                        {formErrors.party && <p className="form-error">{formErrors.party}</p>}
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">
                          No CUSTOMER master in app schema — enter ERP cust code freely.
                        </p>
                      </div>
                    ) : (
                    <SearchSelect
                      label="Party Name"
                      placeholder={
                        issueOption === "Supplier" || issueOption === "Issue to Supplier"
                          ? "Search supplier code / name…"
                          : "Search subcontractor code / name…"
                      }
                      query={partyQuery}
                      onQueryChange={setPartyQuery}
                      selected={
                        issueOption === "Supplier" || issueOption === "Issue to Supplier"
                          ? supCode
                            ? {
                                primary: supCode,
                                secondary: suppliers.find((s) => s.supCode === supCode)?.supName,
                              }
                            : null
                          : subCode
                            ? {
                                primary: subCode,
                                secondary: subs.find((s) => s.subCode === subCode)?.subName,
                              }
                            : null
                      }
                      onClear={() => {
                        setSubCode("");
                        setSupCode("");
                        setPartyQuery("");
                      }}
                      items={partySelectItems}
                      onSelect={(item) => {
                        if (issueOption === "Supplier" || issueOption === "Issue to Supplier") {
                          setSupCode(item.id);
                          setSubCode("");
                        } else {
                          setSubCode(item.id);
                          setSupCode("");
                        }
                        setPartyQuery("");
                        setFormErrors((prev) => ({ ...prev, party: "" }));
                      }}
                      error={formErrors.party}
                      emptyText="No parties match your search"
                    />
                    )}
                    <div>
                      <label className="form-label">Issue Purpose</label>
                      <input value={issuePurpose} onChange={(e) => setIssuePurpose(e.target.value)} className="form-control" maxLength={100} />
                    </div>
                    <div>
                      <label className="form-label">From Unit</label>
                      <input value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} className="form-control" maxLength={15} />
                    </div>
                    <div>
                      <label className="form-label">Mat Type</label>
                      <input value={matType} onChange={(e) => setMatType(e.target.value)} className="form-control" maxLength={20} />
                    </div>
                    <div>
                      <label className="form-label">Ref No</label>
                      <input value={dcRefNo} onChange={(e) => setDcRefNo(e.target.value)} className="form-control" placeholder="Ref No" maxLength={20} />
                    </div>
                  </div>
                </FormModalSection>

                <FormModalSection title="Return terms">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Is Returnable?</label>
                      <select value={returnable} onChange={(e) => setReturnable(e.target.value as "Yes" | "No")} className="form-control">
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Return Due Date *</label>
                      <input
                        id="form-duedate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          setFormErrors((prev) => ({ ...prev, dueDate: "" }));
                        }}
                        className="form-control"
                      />
                      {formErrors.dueDate && <p className="form-error">{formErrors.dueDate}</p>}
                    </div>
                    <div>
                      <label className="form-label">Receiver Name 1 *</label>
                      <input
                        id="form-receive-name"
                        value={receiveName}
                        onChange={(e) => setReceiveName(e.target.value)}
                        className="form-control"
                        maxLength={50}
                      />
                      {formErrors.receiveName && <p className="form-error">{formErrors.receiveName}</p>}
                    </div>
                    <div>
                      <label className="form-label">Receiver Name 2</label>
                      <input value={receiveNameTwo} onChange={(e) => setReceiveNameTwo(e.target.value)} className="form-control" maxLength={50} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">LOB Type *</label>
                      <select
                        value={lobType}
                        onChange={(e) => {
                          setLobType(e.target.value);
                          setFormErrors((prev) => ({ ...prev, lobType: "" }));
                        }}
                        className="form-control"
                      >
                        {LOB_TYPES.map((lob) => (
                          <option key={lob} value={lob}>{lob}</option>
                        ))}
                      </select>
                      {formErrors.lobType && <p className="form-error">{formErrors.lobType}</p>}
                    </div>
                  </div>
                </FormModalSection>

                <FormModalSection title="Transport details">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Transporter Name</label>
                      <input value={transportName} onChange={(e) => setTransportName(e.target.value)} className="form-control" maxLength={50} />
                    </div>
                    <div>
                      <label className="form-label">Vehicle No</label>
                      <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="form-control" maxLength={25} />
                    </div>
                  </div>
                </FormModalSection>

                <FormModalSection title="Additional details">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">PO Number</label>
                      <input value={poOrderNo} onChange={(e) => setPoOrderNo(e.target.value)} className="form-control" maxLength={15} placeholder="-SELECT-" />
                    </div>
                    <div>
                      <label className="form-label">Employee ID</label>
                      <input id="form-emp-id" value={empId} onChange={(e) => setEmpId(e.target.value)} className="form-control" placeholder="0" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">Comments</label>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        maxLength={100}
                        rows={3}
                        className="form-control min-h-[4.5rem] h-auto py-2 resize-y"
                      />
                    </div>
                  </div>
                </FormModalSection>

                <FormModalSection
                  title="Tool line items"
                  action={
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      {stagedLines.length} staged · qty {stagedLines.reduce((sum, l) => sum + l.issueQty, 0)}
                    </span>
                  }
                >
                  <p className="text-xs text-[var(--text-muted)] -mt-1">
                    Search an in-stock tool, then click to add a line. Same tool increases qty (up to Available).
                    Stock reduces only when serial numbers are not maintained.
                  </p>

                  <SearchSelect
                    id="tool-select-search"
                    label="Tool / Gauge"
                    placeholder="Search tool number…"
                    query={searchVal}
                    onQueryChange={(val) => {
                      setSearchVal(val);
                      if (toolSearchTimer.current) clearTimeout(toolSearchTimer.current);
                      toolSearchTimer.current = setTimeout(() => fetchToolsForSearch(val), 300);
                    }}
                    minQueryLength={2}
                    loading={toolSearching}
                    items={toolSelectItems}
                    onSelect={(item) => {
                      const tool = tools.find((t) => String(t.refNo) === item.id);
                      if (tool) handleSelectTool(tool);
                      setSearchVal("");
                      setTools([]);
                      setZeroStockHints([]);
                    }}
                    emptyText={
                      searchVal.trim().length < 2
                        ? "Type at least 2 characters"
                        : `No in-stock tools match “${searchVal}”`
                    }
                    error={formErrors.lines}
                  />

                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["#", "Item No", "Description", "Qty", "Avl", "Price", "Amount", "Machine", "Part No", "Process", "Ret.?", "Sl.No", ""].map((col) => (
                            <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {stagedLines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono text-xs font-semibold">{line.toolOrGaugeNo}</td>
                            <td className="py-2 px-3 text-xs">{line.toolName}</td>
                            <td className="py-2 px-3">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Decrease qty"
                                  disabled={line.issueQty <= 1}
                                  onClick={() => bumpQty(idx, -1)}
                                  className="w-6 h-6 rounded-md border border-[var(--border-main)] text-xs font-bold disabled:opacity-40 hover:bg-[var(--bg-hover)]"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={line.maintainsSerial ? undefined : line.qtyAvailable}
                                  value={line.issueQty}
                                  onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                                  className="w-14 text-center text-xs border border-[var(--border-main)] rounded-lg py-1 bg-[var(--bg-card)] font-mono font-semibold"
                                />
                                <button
                                  type="button"
                                  aria-label="Increase qty"
                                  disabled={!line.maintainsSerial && line.issueQty >= line.qtyAvailable}
                                  onClick={() => bumpQty(idx, 1)}
                                  className="w-6 h-6 rounded-md border border-[var(--border-main)] text-xs font-bold disabled:opacity-40 hover:bg-[var(--bg-hover)]"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-xs text-[var(--color-success-text)] font-bold">
                              {line.maintainsSerial ? "Serial" : line.qtyAvailable}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.price}
                                onChange={(e) => patchLine(idx, { price: Number(e.target.value) || 0 })}
                                className="w-20 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)] font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {(line.price * line.issueQty).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3">
                              {line.machineOptions.length > 0 ? (
                                <select
                                  value={line.machine}
                                  onChange={(e) => patchLine(idx, { machine: e.target.value })}
                                  className="min-w-[100px] text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)] font-mono"
                                >
                                  <option value="">-SELECT-</option>
                                  {line.machineOptions.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={line.machine}
                                  onChange={(e) => patchLine(idx, { machine: e.target.value })}
                                  placeholder="MAC"
                                  className="w-24 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)] font-mono"
                                  maxLength={50}
                                />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={line.partNo}
                                onChange={(e) => patchLine(idx, { partNo: e.target.value })}
                                className="w-24 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)] font-mono"
                                maxLength={50}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={line.processName}
                                onChange={(e) => patchLine(idx, { processName: e.target.value })}
                                className="w-28 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)]"
                                maxLength={100}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={line.returnable}
                                onChange={(e) => patchLine(idx, { returnable: e.target.value })}
                                className="text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)]"
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={line.serialNo}
                                onChange={(e) => patchLine(idx, { serialNo: e.target.value })}
                                className="w-16 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-card)] font-mono"
                                placeholder={line.maintainsSerial ? "Req" : "—"}
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {stagedLines.length === 0 && (
                          <tr>
                            <td colSpan={13} className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
                              No records found. Search Tools Or Gauge No above to add.
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

          {editIssue && (
            <OverlayModal
              open
              size="xl"
              title={`Edit DC ${editIssue.dcNo}`}
              subtitle="Update open issue header fields"
              onClose={() => {
                setEditIssue(null);
                handleClearForm();
              }}
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditIssue(null);
                      handleClearForm();
                    }}
                    className="form-btn-cancel"
                  >
                    Close
                  </button>
                  <button type="submit" form="issue-edit-form" className="form-btn-save">
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </>
              }
            >
              <form id="issue-edit-form" onSubmit={handleSaveEdit} className="space-y-4">
                <div className="form-grid">
                  <div>
                    <label className="form-label">Receiver Name *</label>
                    <input value={receiveName} onChange={(e) => setReceiveName(e.target.value)} className="form-control" required />
                  </div>
                  <div>
                    <label className="form-label">Due Date *</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="form-control" required />
                  </div>
                  <div>
                    <label className="form-label">Search By</label>
                    <select
                      value={issueOption}
                      onChange={(e) => {
                        setIssueOption(e.target.value);
                        setSubCode("");
                        setSupCode("");
                        setCustCode("");
                      }}
                      className="form-control"
                    >
                      {ISSUE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  {issueOption === "Customer" ? (
                    <div>
                      <label className="form-label">Customer Code *</label>
                      <input
                        value={custCode}
                        onChange={(e) => setCustCode(e.target.value.toUpperCase())}
                        className="form-control font-mono uppercase"
                        maxLength={12}
                        required
                      />
                      {formErrors.party && <p className="form-error">{formErrors.party}</p>}
                    </div>
                  ) : issueOption === "Supplier" || issueOption === "Issue to Supplier" ? (
                    <div>
                      <label className="form-label">Supplier Code</label>
                      <input value={supCode} onChange={(e) => setSupCode(e.target.value)} className="form-control font-mono" maxLength={10} />
                    </div>
                  ) : (
                    <div>
                      <label className="form-label">SubContractor Code</label>
                      <input value={subCode} onChange={(e) => setSubCode(e.target.value)} className="form-control font-mono" maxLength={10} />
                    </div>
                  )}
                  <div>
                    <label className="form-label">Issue Purpose</label>
                    <input value={issuePurpose} onChange={(e) => setIssuePurpose(e.target.value)} className="form-control" maxLength={100} />
                  </div>
                  <div>
                    <label className="form-label">From Unit</label>
                    <input value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} className="form-control" maxLength={15} />
                  </div>
                  <div>
                    <label className="form-label">Mat Type</label>
                    <input value={matType} onChange={(e) => setMatType(e.target.value)} className="form-control" maxLength={20} />
                  </div>
                  <div>
                    <label className="form-label">Transport</label>
                    <input value={transportName} onChange={(e) => setTransportName(e.target.value)} className="form-control" />
                  </div>
                  <div>
                    <label className="form-label">Vehicle No</label>
                    <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="form-control" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="form-label">Comments</label>
                    <input value={comments} onChange={(e) => setComments(e.target.value)} className="form-control" maxLength={100} />
                  </div>
                </div>
              </form>
            </OverlayModal>
          )}
        </main>
      </div>
    </div>
  );
}
