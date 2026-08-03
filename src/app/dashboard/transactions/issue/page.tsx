"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash, Search, ArrowUpRight, CheckCircle2, X, ShieldAlert, Users, CalendarClock, Truck, MessageSquareText, ChevronDown } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { FileText, Clock, PackageCheck, AlertCircle } from "lucide-react";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useSuccessOverlay } from "@/components/SuccessOverlay";

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
  subCode: string | null;
  empId: string | null;
  issueDate: string | null;
  dueDate: string | null;
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

const inputCls =
  "w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium";
const labelCls = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1";

/** Compact controls for the ERP issue header card */
const headerInputCls =
  "w-full h-8 text-xs border border-[var(--border-main)] rounded-md px-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]";
const headerLabelCls =
  "block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5 leading-none";
const headerFieldCls = "min-w-0";
const headerErrCls = "text-[10px] text-[var(--color-danger-text)] mt-0.5 font-semibold leading-tight";

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
  const { showSuccess } = useSuccessOverlay();
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

  // Success Banner
  const [successBanner, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Header State (ERP Tools Issue fields)
  const [receiveName, setReceiveName] = useState("");
  const [receiveNameTwo, setReceiveNameTwo] = useState("");
  const [subCode, setSubCode] = useState("");
  const [supCode, setSupCode] = useState("");
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
  const [subs, setSubs] = useState<SubOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupOption[]>([]);

  // Staged lines
  const [stagedLines, setStagedLines] = useState<StagedLine[]>([]);

  // Search/Dropdown selection state
  const [searchVal, setSearchVal] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const loadIssues = useCallback(async (p = page, q = searchQuery, status = listStatusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (q) params.set("search", q);
    if (status && status !== "All") params.set("status", status);
    const res = await apiGet<{ items: ToolsIssueHeader[]; total: number }>(`/api/issue?${params}`);
    if (res.data?.items) setIssues(res.data.items);
    if (res.data?.total !== undefined) setTotal(res.data.total);
    setLoading(false);
  }, [page, searchQuery, listStatusFilter]);

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
      return;
    }
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


  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setShowSearchDropdown(false);
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
    setStagedLines([]);
    setFormErrors({});
  };

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
    if (stagedLines.length === 0) errors.lines = "At least one tool line item must be added to issue slip";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const empParsed = empId.trim() ? Number(empId) : 0;
    const payload = {
      receiveName,
      receiveNameTwo: receiveNameTwo || undefined,
      subCode: subCode || undefined,
      supCode: supCode || undefined,
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

    setBannerMsg(null);
    const res = await apiPost<{ issue: ToolsIssueHeader }>("/api/issue", payload);

    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }

    if (res.data?.issue) {
      const msg = `DC #${res.data.issue.dcNo} issued successfully to ${receiveName}!`;
      setSuccessBanner(msg);
      showSuccess({
        title: "Issue DC created",
        message: `Tools issued successfully to ${receiveName}.`,
        detail: `DC #${res.data.issue.dcNo}`,
      });
      handleClearForm();
      setShowCreate(false);
      loadIssues(1, searchQuery, listStatusFilter);
      setPage(1);
      setTimeout(() => setSuccessBanner(""), 5000);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successBanner && (
            <div className="mb-4 p-4 bg-[var(--color-success-bg)] border border-[var(--border-main)] rounded-2xl flex items-center gap-2.5 text-[var(--color-success-text)] text-sm font-semibold shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successBanner}</span>
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
              <button
                onClick={() => setBannerMsg(null)}
                className="ml-auto text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

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
            <RoleGate permission="canCreateIssue">
              {!showCreate && (
                <Button
                  id="issue-create-btn"
                  onClick={() => setShowCreate(true)}
                  variant="primary"
                  className="group"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                  New Issue (DC)
                </Button>
              )}
            </RoleGate>
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

          {!showCreate ? (
            /* ── VIEW PREVIOUS ISSUES LIST ── */
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Search + status filter tabs */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="issue-search-input"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search DC No, name, or subcontractor…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-[var(--bg-subtle)] rounded-lg p-1">
                      {(["All", "Open", "Closed", "Overdue"] as const).map((f) => (
                        <button
                          key={f}
                          id={`issue-status-filter-${f.toLowerCase()}`}
                          type="button"
                          onClick={() => handleStatusTabChange(f)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            listStatusFilter === f
                              ? "bg-[var(--bg-surface)] shadow-sm text-[var(--text-primary)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">
                      {loading ? "Loading…" : `Showing ${issues.length} of ${total.toLocaleString()} records`}
                    </span>
                  </div>
                </div>
              </div>
              {loading ? (
                <TableSkeleton rows={3} />
              ) : issues.length === 0 ? (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-8 text-center text-sm text-[var(--text-muted)]">
                  {searchQuery || listStatusFilter !== "All"
                    ? `No ${listStatusFilter === "All" ? "" : listStatusFilter.toLowerCase() + " "}records found${searchQuery ? ` for "${searchQuery}"` : ""}.`
                    : "No issue records found. Create a new issue to get started."}
                </div>
              ) : (
                issues.map((issue) => {
                  const sc = statusConfig[issue.status] ?? statusConfig["OPEN"];
                  return (
                    <div key={issue.dcNo} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{issue.dcNo}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {issue.receiveName ?? "—"} · Issued {issue.issueDate ? issue.issueDate.split("T")[0] : "—"} · Due {issue.dueDate ? issue.dueDate.split("T")[0] : "—"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                        >
                          {issue.status}
                        </span>
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
                })
              )}

              {/* Pagination controls */}
              {total > pageSize && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)]">
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
              )}
            </div>
          ) : (
            /* ── ACTIVE CREATE ISSUE MODE (60% / 40% side by side) ── */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start animate-fade-in">
              {/* LEFT FORM PANEL */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Form title bar */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
                      Tools / Gauge / Other Item Issue
                    </h2>
                    <span className="font-mono text-[10px] text-[var(--text-muted)] font-bold bg-[var(--bg-subtle)] px-2 py-0.5 rounded">
                      DC No: Auto
                    </span>
                  </div>
                </div>

                {/* 1. Who and what */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-[var(--primary)] shrink-0" />
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
                      Who and what
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3">
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>DC Date</label>
                      <input type="date" value={issueDate} readOnly className={`${headerInputCls} cursor-not-allowed opacity-80`} />
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Search By</label>
                      <select
                        value={issueOption}
                        onChange={(e) => {
                          setIssueOption(e.target.value);
                          setSubCode("");
                          setSupCode("");
                        }}
                        className={headerInputCls}
                      >
                        {ISSUE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Party Name</label>
                      {issueOption === "Supplier" || issueOption === "Issue to Supplier" ? (
                        <select
                          value={supCode}
                          onChange={(e) => setSupCode(e.target.value)}
                          className={headerInputCls}
                        >
                          <option value="">-SELECT-</option>
                          {suppliers.map((s) => (
                            <option key={s.supCode || s.id} value={s.supCode}>
                              {s.supCode} — {s.supName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={subCode}
                          onChange={(e) => setSubCode(e.target.value)}
                          className={headerInputCls}
                        >
                          <option value="">-SELECT-</option>
                          {subs.map((s) => (
                            <option key={s.subCode || s.id} value={s.subCode}>
                              {s.subCode} — {s.subName}
                            </option>
                          ))}
                        </select>
                      )}
                      {formErrors.party && <p className={headerErrCls}>{formErrors.party}</p>}
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Ref No</label>
                      <input value={dcRefNo} onChange={(e) => setDcRefNo(e.target.value)} className={headerInputCls} placeholder="Ref No" maxLength={20} />
                    </div>
                  </div>
                </div>

                {/* 2. Return terms */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarClock className="w-4 h-4 text-[var(--primary)] shrink-0" />
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
                      Return terms
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3">
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Is Returnable?</label>
                      <select value={returnable} onChange={(e) => setReturnable(e.target.value as "Yes" | "No")} className={headerInputCls}>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Return Due Date *</label>
                      <input
                        id="form-duedate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          setFormErrors((prev) => ({ ...prev, dueDate: "" }));
                        }}
                        className={headerInputCls}
                      />
                      {formErrors.dueDate && <p className={headerErrCls}>{formErrors.dueDate}</p>}
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Receiver Name 1 *</label>
                      <input
                        id="form-receive-name"
                        value={receiveName}
                        onChange={(e) => setReceiveName(e.target.value)}
                        className={headerInputCls}
                        maxLength={50}
                      />
                      {formErrors.receiveName && <p className={headerErrCls}>{formErrors.receiveName}</p>}
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Receiver Name 2</label>
                      <input value={receiveNameTwo} onChange={(e) => setReceiveNameTwo(e.target.value)} className={headerInputCls} maxLength={50} />
                    </div>
                    <div className={`${headerFieldCls} md:col-span-2`}>
                      <label className={headerLabelCls}>LOB Type *</label>
                      <select
                        value={lobType}
                        onChange={(e) => {
                          setLobType(e.target.value);
                          setFormErrors((prev) => ({ ...prev, lobType: "" }));
                        }}
                        className={headerInputCls}
                      >
                        {LOB_TYPES.map((lob) => (
                          <option key={lob} value={lob}>{lob}</option>
                        ))}
                      </select>
                      {formErrors.lobType && <p className={headerErrCls}>{formErrors.lobType}</p>}
                    </div>
                  </div>
                </div>

                {/* 3. Transport details — collapsed unless values present */}
                <details
                  className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] p-5 group"
                  defaultOpen={Boolean(transportName.trim() || vehicleNo.trim())}
                >
                  <summary className="flex items-center gap-2 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                    <Truck className="w-4 h-4 text-[var(--primary)] shrink-0" />
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest flex-1">
                      Transport details
                    </h3>
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3 mt-3">
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Transporter Name</label>
                      <input value={transportName} onChange={(e) => setTransportName(e.target.value)} className={headerInputCls} maxLength={50} />
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Vehicle No</label>
                      <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={headerInputCls} maxLength={25} />
                    </div>
                  </div>
                </details>

                {/* 4. Additional details — collapsed unless values present */}
                <details
                  className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] p-5 group"
                  defaultOpen={Boolean(poOrderNo.trim() || empId.trim() || comments.trim())}
                >
                  <summary className="flex items-center gap-2 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                    <MessageSquareText className="w-4 h-4 text-[var(--primary)] shrink-0" />
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest flex-1">
                      Additional details
                    </h3>
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3 mt-3">
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>PO Number</label>
                      <input value={poOrderNo} onChange={(e) => setPoOrderNo(e.target.value)} className={headerInputCls} maxLength={15} placeholder="-SELECT-" />
                    </div>
                    <div className={headerFieldCls}>
                      <label className={headerLabelCls}>Employee ID</label>
                      <input id="form-emp-id" value={empId} onChange={(e) => setEmpId(e.target.value)} className={headerInputCls} placeholder="0" />
                    </div>
                    <div className={`${headerFieldCls} md:col-span-2`}>
                      <label className={headerLabelCls}>Comments</label>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        maxLength={100}
                        rows={3}
                        className={`${headerInputCls} h-auto min-h-[4.5rem] py-2 resize-y`}
                      />
                    </div>
                  </div>
                </details>

                <p className="text-[10px] font-medium text-[var(--text-muted)] px-0.5">
                  Note: Stock reduces only when serial numbers are not maintained.
                </p>

                {/* Line Items Card */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3 space-y-3">
                  <div className="pb-2 border-b border-[var(--border-main)]">
                    <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">Tool Line Items</h2>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Search and click a tool to add a line. Same tool increases qty (up to Available).
                    </p>
                  </div>

                  {/* Smart Tool Search Input */}
                  <div className="relative" ref={dropdownRef}>
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tool-select-search"
                      value={searchVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchVal(val);
                        setShowSearchDropdown(true);
                        // Debounced on-demand fetch — no pre-loaded tool list
                        if (toolSearchTimer.current) clearTimeout(toolSearchTimer.current);
                        toolSearchTimer.current = setTimeout(() => fetchToolsForSearch(val), 300);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder={
                        stagedLines.length > 0
                          ? "Search another in-stock tool to add a 2nd line…"
                          : "Search in-stock tools — e.g. OTH_J-0001 or TEST-CAL-001"
                      }
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />

                    {/* Popover results */}
                    {showSearchDropdown && searchVal.trim().length > 0 && (
                      <div className="absolute z-10 w-full bg-[var(--bg-surface)] border border-[var(--border-main)] shadow-lg rounded-xl mt-1 max-h-56 overflow-y-auto divide-y divide-[var(--border-main)]">
                        {searchResults.map((t) => (
                          <div
                            key={t.refNo}
                            onClick={() => handleSelectTool(t)}
                            className="p-3 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors flex items-center justify-between text-sm"
                          >
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">
                                {!t.name || t.name.trim().toUpperCase() === "N/A"
                                  ? t.toolOrGaugeNo
                                  : t.name}
                              </p>
                              <p className="text-xs font-mono text-[var(--text-muted)]">
                                {t.toolOrGaugeNo} · {t.grouping}
                                {toolMaintainsSerial(t.serialNoGenReq) ? " · Serial tracked" : ""}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-[var(--color-success-text)] font-mono bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full border border-[var(--border-main)]">
                              {getAvailableStock(t.toolOrGaugeNo)} in-stock
                            </span>
                          </div>
                        ))}
                        {searchResults.length === 0 && (
                          <div className="p-3 text-xs text-[var(--text-muted)] space-y-2">
                            <p className="font-semibold text-[var(--text-primary)] text-center">
                              No in-stock tools match “{searchVal}”.
                            </p>
                            {zeroStockHints.length > 0 && (
                              <div className="rounded-lg border border-[var(--border-main)] divide-y divide-[var(--border-main)] overflow-hidden">
                                {zeroStockHints.map((t) => (
                                  <div
                                    key={t.refNo}
                                    className="px-3 py-2 flex items-center justify-between bg-[var(--bg-subtle)] opacity-80"
                                  >
                                    <div>
                                      <p className="font-mono text-[var(--text-secondary)]">{t.toolOrGaugeNo}</p>
                                      <p className="text-[11px]">{t.name || t.grouping}</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                      0 stock — cannot issue
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-center">
                              Use a tool with Qty In &gt; 0, or create one with Tot Qty ≥ 1. Live stock:{" "}
                              <button
                                type="button"
                                className="font-mono font-semibold text-[var(--primary)] underline"
                                onClick={() => {
                                  setSearchVal("OTH_J-0001");
                                  setShowSearchDropdown(true);
                                  void fetchToolsForSearch("OTH_J-0001");
                                }}
                              >
                                OTH_J-0001
                              </button>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {formErrors.lines && (
                    <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--color-danger-text)] font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span>{formErrors.lines}</span>
                    </div>
                  )}

                  {/* Issue List — ERP columns */}
                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {[
                            "#",
                            "Item No",
                            "Description",
                            "Qty",
                            "Avl",
                            "Price",
                            "Amount",
                            "Machine",
                            "Part No",
                            "Process",
                            "Ret.?",
                            "Sl.No",
                            "",
                          ].map((col) => (
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
                                  className="w-14 text-center text-xs border border-[var(--border-main)] rounded-lg py-1 bg-[var(--bg-subtle)] font-mono font-semibold"
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
                                className="w-20 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)] font-mono"
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
                                  className="min-w-[100px] text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)] font-mono"
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
                                  className="w-24 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)] font-mono"
                                  maxLength={50}
                                />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={line.partNo}
                                onChange={(e) => patchLine(idx, { partNo: e.target.value })}
                                className="w-24 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)] font-mono"
                                maxLength={50}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={line.processName}
                                onChange={(e) => patchLine(idx, { processName: e.target.value })}
                                className="w-28 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)]"
                                maxLength={100}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={line.returnable}
                                onChange={(e) => patchLine(idx, { returnable: e.target.value })}
                                className="text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)]"
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                value={line.serialNo}
                                onChange={(e) => patchLine(idx, { serialNo: e.target.value })}
                                className="w-16 text-xs border border-[var(--border-main)] rounded-lg px-2 py-1 bg-[var(--bg-subtle)] font-mono"
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
                </div>

                {/* Form submit/reset buttons */}
                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-app)] py-4 border-t border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => {
                      handleClearForm();
                      setShowCreate(false);
                    }}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Clear Form
                  </button>
                  <Button
                    type="submit"
                    id="submit-issue-btn"
                    variant="primary"
                    size="lg"
                  >
                    <ArrowUpRight className="w-4 h-4" /> Submit Issue
                  </Button>
                </div>
              </form>

              {/* RIGHT STOCK QUICK-VIEW PANEL (40%) */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4 sticky top-6">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Current Stock View</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Live staging impact summary</p>
                </div>

                <div className="border-y border-[var(--border-main)] py-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)] font-medium">Tools Staged</span>
                    <span className="font-bold text-[var(--text-primary)]">{stagedLines.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)] font-medium">Total Quantity</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {stagedLines.reduce((sum, l) => sum + l.issueQty, 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Live Staged Impact</p>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {stagedLines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-sans">
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-[var(--text-primary)] truncate">{l.toolName}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)]">{l.toolOrGaugeNo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-[var(--text-primary)]">{l.issueQty}</span>
                          <span className="text-[var(--text-muted)]"> / </span>
                          <span className="font-mono text-[var(--text-muted)]">{l.qtyAvailable} stock</span>
                        </div>
                      </div>
                    ))}
                    {stagedLines.length === 0 && (
                      <p className="text-center text-xs text-[var(--text-muted)] py-4 font-medium">
                        No staged lines to summarize.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
