"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash, Save, FileSpreadsheet, Download, Eye, Pencil } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { toastSuccess, toastError } from "@/lib/appToast";
import { downloadExcel } from "@/lib/downloadExcel";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COMPANY_UNITS, normalizeCompanyUnit } from "@/lib/companyUnits";

// ERP uses "Active" for open DCs, "Cancelled"/"Closed" for closed DCs
type IssueStatus = "OPEN" | "CLOSED" | "PARTIAL" | "Active" | "Closed" | "Cancelled";

interface ToolMasterPreview {
  toolOrGaugeNo: string | null;
  name: string | null;
  description: string | null;
  type: string | null;
  grouping: string | null;
  uom: string | null;
  size?: string | null;
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

interface EditableMovementLine {
  rowId?: number;
  toolOrGaugeNo: string;
  name: string;
  serialNo: number | null;
  toUnit: string | null;
}

interface Tool {
  refNo: number;
  toolOrGaugeNo: string;
  name: string;
  grouping: string;
  type?: string | null;
  size?: string | null;
  qtyIn: number;
  totQty?: number;
  location?: string | null;
  locationName?: string | null;
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
  size: string;
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
  const pathname = usePathname();
  const isMovement = pathname.startsWith("/dashboard/movement/");
  const requestedMovementParam = searchParams.get("movement");
  const movementDashboardPath = requestedMovementParam === "internal" || requestedMovementParam === "external"
    ? `/dashboard/movement/history?movement=${requestedMovementParam}`
    : "/dashboard/movement/history";
  const issueBasePath = isMovement ? movementDashboardPath : "/dashboard/transactions/issue";
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
  const [issueOption, setIssueOption] = useState<string>(isMovement ? "Inhouse or SubContractor" : "SubContractor");
  const [dcRefNo, setDcRefNo] = useState("");
  const [returnable, setReturnable] = useState<"Yes" | "No">("Yes");
  const [transportName, setTransportName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [comments, setComments] = useState("");
  const [lobType, setLobType] = useState<string>("AUTOMOTIVE");
  const [poOrderNo, setPoOrderNo] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [toUnit, setToUnit] = useState("");
  const [movementType, setMovementType] = useState<"Internal" | "External">("Internal");
  const [issuePurpose, setIssuePurpose] = useState("");
  const [matType, setMatType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  /** ERP Requisition Pending for Tools — Yes = issue against a pending MR */
  const [requisitionPending, setRequisitionPending] = useState<"Yes" | "No">("No");
  const [reqNo, setReqNo] = useState("");
  /** When opened via Requisition Pending → Issue For Tools, keep Yes + Req No locked */
  const [reqLinkLocked, setReqLinkLocked] = useState(false);
  const [pendingReqs, setPendingReqs] = useState<
    { reqNo: string; reqDate: string | null; empCd: number | null; deptId: number | null; headerStatus: string | null }[]
  >([]);
  const [loadingPendingReqs, setLoadingPendingReqs] = useState(false);
  const [editIssue, setEditIssue] = useState<ToolsIssueHeader | null>(null);
  const [viewIssue, setViewIssue] = useState<ToolsIssueHeader | null>(null);
  const [editMovementLines, setEditMovementLines] = useState<EditableMovementLine[]>([]);
  const [subs, setSubs] = useState<SubOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupOption[]>([]);

  // Staged lines
  const [stagedLines, setStagedLines] = useState<StagedLine[]>([]);
  const bulkMovementApplied = useRef(false);

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
    void (async () => {
      const [subRes, supRes] = await Promise.all([
        apiGet<{ items?: SubOption[] }>("/api/subcontractors?pageSize=200"),
        apiGet<{ items?: SupOption[] }>("/api/suppliers?pageSize=200"),
      ]);
      setSubs(subRes.data?.items ?? []);
      setSuppliers(supRes.data?.items ?? []);
    })();
  }, []);

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
    if (isMovement) params.set("movementOnly", "1");
    const res = await apiGet<{ items: ToolsIssueHeader[]; total: number }>(`/api/issue?${params}`);
    if (res.data?.items) setIssues(res.data.items);
    if (res.data?.total !== undefined) setTotal(res.data.total);
    setLoading(false);
  }, [page, searchQuery, listStatusFilter, fromDate, toDate, isMovement]);

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
      if (isMovement) {
        const result = await apiGet<{ items: Tool[] }>(
          `/api/tools?search=${encodeURIComponent(q)}&pageSize=20`
        );
        setTools(result.data?.items ?? []);
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
    } finally {
      setToolSearching(false);
    }
  }, [isMovement]);

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
      t.size?.toLowerCase().includes(queryLower) ||
      t.toolOrGaugeNo.toLowerCase().includes(queryLower);
    return matches && (isMovement || Number(t.qtyIn ?? 0) > 0);
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
          ? `${t.grouping}${t.size ? ` · Size: ${t.size}` : ""}`
          : `${t.name}${t.size ? ` · Size: ${t.size}` : ""}${toolMaintainsSerial(t.serialNoGenReq) ? " · Serial tracked" : ""}`,
      right: (
        <span className="text-[10px] font-bold text-[var(--color-success-text)] font-mono bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full border border-[var(--border-main)]">
          {isMovement ? "Single instrument" : `${getAvailableStock(t.toolOrGaugeNo)} in-stock`}
        </span>
      ),
    })),
    ...zeroStockHints.map((t) => ({
      id: `zero-${t.refNo}`,
      primary: t.toolOrGaugeNo,
      secondary: `${t.name || t.grouping}${t.size ? ` · Size: ${t.size}` : ""}`,
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
    if (!isMovement && !serialTracked && currentAvail <= 0) return;
    if (isMovement && movementType === "Internal") {
      const toolUnit = normalizeCompanyUnit(tool.locationName);
      if (!toolUnit) {
        setFormErrors((previous) => ({
          ...previous,
          lines: `${toolNo} has no valid Current Unit. Set it to Unit 1, Unit 2, or Unit 3 first.`,
        }));
        return;
      }
      if (fromUnit && fromUnit !== toolUnit) {
        setFormErrors((previous) => ({
          ...previous,
          lines: `All instruments in one movement must come from ${fromUnit}. ${toolNo} belongs to ${toolUnit}.`,
        }));
        return;
      }
      setFromUnit(toolUnit);
    }

    const existingIdx = stagedLines.findIndex((l) => l.toolOrGaugeNo === toolNo);
    if (existingIdx >= 0) {
      if (isMovement) return;
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
          size: tool.size || "",
          grouping: tool.grouping || "",
          type: tool.type || "",
          issueQty: 1,
          qtyAvailable: isMovement ? 1 : Number(tool.qtyIn ?? 0),
          totQty: isMovement ? 1 : Number(tool.totQty ?? tool.qtyIn ?? 0),
          location: tool.location || "",
          returnable: tool.returnable === "No" ? "No" : returnable,
          serialNo: "",
          machine: tool.machines?.[0] || "",
          processName: "",
          partNo: toolNo,
          price: 0,
          maintainsSerial: isMovement || serialTracked,
          machineOptions: tool.machines ?? [],
        },
      ]);
    }
    setSearchVal("");
    setFormErrors((prev) => ({ ...prev, lines: "" }));
  };

  useEffect(() => {
    if (!isMovement || !showCreate || bulkMovementApplied.current) return;
    const raw = sessionStorage.getItem("bulkIssueLines");
    if (!raw) return;
    bulkMovementApplied.current = true;

    void (async () => {
      try {
        const requested = JSON.parse(raw) as Array<{
          refNo?: number;
          toolOrGaugeNo?: string;
          description?: string;
        }>;
        const valid = requested.filter((item) => item.toolOrGaugeNo?.trim());
        if (valid.length === 0) {
          toastError("No valid instruments were passed from Instrument Master.");
          return;
        }

        const resolved = await Promise.all(
          valid.map(async (item) => {
            const toolNo = item.toolOrGaugeNo!.trim();
            const result = await apiGet<{ items?: Tool[] }>(
              `/api/tools?search=${encodeURIComponent(toolNo)}&pageSize=10`
            );
            const tool = result.data?.items?.find(
              (row) =>
                row.refNo === item.refNo ||
                row.toolOrGaugeNo.trim().toLowerCase() === toolNo.toLowerCase()
            );
            return tool ? { tool, requested: item } : null;
          })
        );

        const found = resolved.filter(
          (entry): entry is { tool: Tool; requested: (typeof valid)[number] } => entry !== null
        );
        if (found.length === 0) {
          toastError("Selected instruments could not be fetched from Tools Master.");
          return;
        }

        const unitRows = found.map(({ tool }) => ({
          tool,
          unit: normalizeCompanyUnit(tool.locationName),
        }));
        const missingUnit = unitRows.find((entry) => !entry.unit);
        if (movementType === "Internal" && missingUnit) {
          setFormErrors((previous) => ({
            ...previous,
            lines: `${missingUnit.tool.toolOrGaugeNo} has no valid Current Unit. Update it in Instrument Master first.`,
          }));
          return;
        }
        const sourceUnits = [...new Set(unitRows.map((entry) => entry.unit).filter(Boolean))];
        if (movementType === "Internal" && sourceUnits.length > 1) {
          setFormErrors((previous) => ({
            ...previous,
            lines: "Selected instruments belong to different units. Create one movement per source unit.",
          }));
          return;
        }

        const staged = found.map(({ tool, requested: item }) => ({
          toolOrGaugeNo: tool.toolOrGaugeNo,
          toolName:
            !tool.name || tool.name.trim().toUpperCase() === "N/A"
              ? tool.toolOrGaugeNo
              : tool.name,
          description: item.description || tool.name || "",
          size: tool.size || "",
          grouping: tool.grouping || "",
          type: tool.type || "",
          issueQty: 1,
          qtyAvailable: 1,
          totQty: 1,
          location: tool.location || "",
          returnable: tool.returnable === "No" ? "No" : "Yes",
          serialNo: "",
          machine: tool.machines?.[0] || "",
          processName: "",
          partNo: tool.toolOrGaugeNo,
          price: 0,
          maintainsSerial: true,
          machineOptions: tool.machines ?? [],
        } satisfies StagedLine));

        setStagedLines(staged);
        if (sourceUnits[0]) setFromUnit(sourceUnits[0]);
        setFormErrors((previous) => ({ ...previous, lines: "" }));
        toastSuccess(`${staged.length} instrument(s) added to the movement.`);
      } catch {
        toastError("Could not load the selected instruments for movement.");
      } finally {
        sessionStorage.removeItem("bulkIssueLines");
      }
    })();
  }, [isMovement, showCreate, movementType]);

  const patchLine = (index: number, patch: Partial<StagedLine>) => {
    setStagedLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const updated = [...stagedLines];
    const line = updated[index];
    const maxVal = line.maintainsSerial ? 9999 : Math.max(0, line.qtyAvailable);
    const raw = Number.isFinite(newQty) ? newQty : 1;
    if (!line.maintainsSerial && maxVal <= 0) {
      setFormErrors((prev) => ({
        ...prev,
        lines: `No stock (AVL 0) for ${line.toolOrGaugeNo}. Open Tools Master and raise Qty In before issuing.`,
      }));
      updated[index].issueQty = 0;
      setStagedLines(updated);
      return;
    }
    if (!line.maintainsSerial && raw > maxVal) {
      setFormErrors((prev) => ({
        ...prev,
        lines: `Only ${maxVal} available for ${line.toolOrGaugeNo}. Raise Qty In on Item/Asset Master to issue more.`,
      }));
    } else {
      setFormErrors((prev) => ({ ...prev, lines: "" }));
    }
    updated[index].issueQty = Math.min(Math.max(1, raw), maxVal);
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
    setIssueOption(isMovement ? "Inhouse or SubContractor" : "SubContractor");
    setDcRefNo("");
    setReturnable("Yes");
    setTransportName("");
    setVehicleNo("");
    setComments("");
    setLobType("AUTOMOTIVE");
    setPoOrderNo("");
    setFromUnit("");
    setToUnit("");
    setMovementType("Internal");
    setIssuePurpose("");
    setMatType("");
    setRequisitionPending("No");
    setReqNo("");
    setReqLinkLocked(false);
    setPendingReqs([]);
    setStagedLines([]);
    setFormErrors({});
    setPartyQuery("");
    setSearchVal("");
    setTools([]);
    setZeroStockHints([]);
  };

  const loadPendingRequisitions = useCallback(async () => {
    setLoadingPendingReqs(true);
    const res = await apiGet<{
      items?: {
        reqNo: string | null;
        reqDate: string | null;
        empCd: number | null;
        deptId: number | null;
        headerStatus: string | null;
        pending?: boolean;
      }[];
    }>("/api/requisition-pending?status=pending&headerStatus=OPEN&pageSize=200&considerDate=No");
    const byReq = new Map<
      string,
      { reqNo: string; reqDate: string | null; empCd: number | null; deptId: number | null; headerStatus: string | null }
    >();
    for (const row of res.data?.items ?? []) {
      if (!row.reqNo || !row.pending) continue;
      if (!byReq.has(row.reqNo)) {
        byReq.set(row.reqNo, {
          reqNo: row.reqNo,
          reqDate: row.reqDate,
          empCd: row.empCd,
          deptId: row.deptId,
          headerStatus: row.headerStatus,
        });
      }
    }
    setPendingReqs([...byReq.values()]);
    setLoadingPendingReqs(false);
  }, []);

  /** Load open tool lines for a requisition and stage them on the issue slip */
  const stageToolsFromRequisition = useCallback(async (selectedReqNo: string) => {
    const res = await apiGet<{
      items?: {
        toolOrGaugeNo: string | null;
        toolName: string | null;
        description?: string | null;
        grouping?: string | null;
        balanceQty: number;
        pending?: boolean;
        machine?: string | null;
      }[];
    }>(
      `/api/requisition-pending?status=pending&reqNo=${encodeURIComponent(selectedReqNo)}&pageSize=100&considerDate=No`
    );
    const lines = (res.data?.items ?? []).filter(
      (l) => l.pending && l.toolOrGaugeNo && l.balanceQty > 0
    );
    if (lines.length === 0) {
      toastError("No open tool lines with balance on this requisition.");
      return;
    }
    // Enrich with live stock from tools search API when possible
    const staged: StagedLine[] = [];
    for (const l of lines) {
      const toolNo = l.toolOrGaugeNo as string;
      const toolRes = await apiGet<{ items?: Tool[] }>(
        `/api/tools?search=${encodeURIComponent(toolNo)}&pageSize=5`
      );
      const tool =
        toolRes.data?.items?.find((t) => t.toolOrGaugeNo === toolNo) ??
        toolRes.data?.items?.[0];
      const serialTracked = (() => {
        const v = (tool?.serialNoGenReq ?? "").trim().toLowerCase();
        return v === "yes" || v === "y" || v === "1" || v === "true";
      })();
      const qtyIn = Number(tool?.qtyIn ?? 0);
      const bal = Math.max(1, Math.floor(l.balanceQty));
      if (!serialTracked && qtyIn <= 0) {
        toastError(
          `${toolNo}: Qty In is 0 — cannot stage for issue. Raise stock on Tools Master first.`
        );
        continue;
      }
      const issueQty = serialTracked ? bal : Math.min(bal, qtyIn);
      staged.push({
        toolOrGaugeNo: toolNo,
        toolName: tool?.name || l.toolName || toolNo,
        description: tool?.name ? (l.description || "") : l.description || "",
        size: tool?.size || "",
        grouping: tool?.grouping || l.grouping || "",
        type: tool?.type || "",
        issueQty,
        qtyAvailable: qtyIn,
        totQty: Number(tool?.totQty ?? 0),
        location: tool?.location || "",
        returnable: tool?.returnable === "No" ? "No" : "Yes",
        serialNo: "",
        machine: l.machine || "",
        processName: "",
        partNo: toolNo,
        price: 0,
        maintainsSerial: serialTracked,
        machineOptions: tool?.machines ?? [],
      });
    }
    if (staged.length === 0) {
      toastError("No lines could be staged — all tools have zero available stock.");
      return;
    }
    setStagedLines(staged);
    setMatType((m) => m || "TOOLS");
    toastSuccess(`Staged ${staged.length} tool line(s) from ${selectedReqNo}.`);
  }, []);

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

  const downloadMovementDc = async (dcNo: string) => {
    try {
      const res = await fetch(`/api/issue/${encodeURIComponent(dcNo)}/pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to download movement DC");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Movement_DC_${dcNo}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Failed to download movement DC");
    }
  };

  const openEditIssue = (issue: ToolsIssueHeader) => {
    const isExternalRecord = issue.issueOption?.startsWith("External:") ?? false;
    setEditIssue(issue);
    setReceiveName(issue.receiveName ?? "");
    setReceiveNameTwo(issue.receiveNameTwo ?? "");
    setSubCode(issue.subCode ?? "");
    setSupCode(issue.supCode ?? "");
    setCustCode(issue.custCode ?? "");
    setMovementType(isExternalRecord ? "External" : "Internal");
    setIssueOption(isExternalRecord ? issue.issueOption?.slice("External:".length) || "SubContractor" : issue.issueOption || "SubContractor");
    setDueDate(issue.dueDate ? String(issue.dueDate).split("T")[0] : localToday());
    setTransportName(issue.transportName ?? "");
    setVehicleNo(issue.vehicleNo ?? "");
    setComments(issue.comments ?? "");
    setLobType(issue.lobType || "AUTOMOTIVE");
    setPoOrderNo(issue.poOrderNo ?? "");
    setFromUnit(issue.fromUnit ?? "");
    setToUnit(issue.lines.find((line) => line.issueToItemNo)?.issueToItemNo ?? "");
    setEditMovementLines(issue.lines.flatMap((line) => {
      const toolOrGaugeNo = line.toolOrGaugeNo ?? line.tool?.toolOrGaugeNo ?? line.partNo;
      return toolOrGaugeNo ? [{
        rowId: line.rowId,
        toolOrGaugeNo,
        name: line.name ?? line.tool?.name ?? line.toolByRef?.name ?? "—",
        serialNo: line.serialNo ?? null,
        toUnit: line.issueToItemNo ?? null,
      }] : [];
    }));
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
    if (isMovement && editMovementLines.length === 0) {
      setFormErrors({ lines: "A movement DC must contain at least one instrument" });
      return;
    }
    const storedIssueOption = isMovement && movementType === "External" ? `External:${issueOption}` : issueOption;
    const res = await apiPut(`/api/issue/${encodeURIComponent(editIssue.dcNo)}`, {
      receiveName: receiveName.trim(),
      receiveNameTwo: receiveNameTwo || null,
      subCode: issueOption === "Customer" ? null : subCode || null,
      supCode:
        issueOption === "Supplier" || issueOption === "Issue to Supplier" ? supCode || null : null,
      custCode: issueOption === "Customer" ? custCode.trim() : null,
      dueDate,
      issueOption: storedIssueOption,
      returnable,
      transportName: transportName || null,
      vehicleNo: vehicleNo || null,
      comments: comments || null,
      lobType,
      poOrderNo: poOrderNo || null,
      fromUnit: isMovement && movementType === "External" ? null : fromUnit || null,
      issuePurpose: issuePurpose || null,
      matType: matType || null,
      ...(isMovement ? {
        lines: editMovementLines.map((line) => ({
          ...(line.rowId != null ? { rowId: line.rowId } : {}),
          toolOrGaugeNo: line.toolOrGaugeNo,
          issueQty: 1,
          serialNo: line.serialNo,
          toUnit: movementType === "Internal" ? (line.toUnit || toUnit) : null,
        })),
      } : {}),
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
    if (isMovement) {
      const params = new URLSearchParams({ action: "add" });
      if (requestedMovementParam === "internal" || requestedMovementParam === "external") {
        params.set("movement", requestedMovementParam);
      }
      router.replace(`/dashboard/movement/create?${params.toString()}`, { scroll: false });
      return;
    }
    router.replace(`${issueBasePath}?action=add`, { scroll: false });
  }, [isMovement, issueBasePath, requestedMovementParam, router]);

  const closeCreate = useCallback(() => {
    handleClearForm();
    setShowCreate(false);
    router.replace(issueBasePath, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueBasePath, router]);

  useEffect(() => {
    const action = searchParams.get("action");
    const requestedMovement = requestedMovementParam;
    const fromReq = searchParams.get("requisitionPending");
    const qReqNo = (searchParams.get("reqNo") ?? "").trim();
    if (action === "add" || fromReq === "Yes" || qReqNo) {
      if (!showCreate) setShowCreate(true);
      if (isMovement && requestedMovement === "external") setMovementType("External");
      if (isMovement && requestedMovement === "internal") setMovementType("Internal");
      if (fromReq === "Yes" || qReqNo) {
        setRequisitionPending("Yes");
        setReqLinkLocked(true);
        void loadPendingRequisitions().then(() => {
          if (qReqNo) {
            setReqNo(qReqNo);
            void stageToolsFromRequisition(qReqNo);
          }
        });
      }
      return;
    }
    if (showCreate) {
      setShowCreate(false);
      handleClearForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (showCreate && requisitionPending === "Yes" && pendingReqs.length === 0) {
      void loadPendingRequisitions();
    }
  }, [showCreate, requisitionPending, pendingReqs.length, loadPendingRequisitions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!receiveName.trim()) errors.receiveName = isMovement ? "Receiver name is required" : "Receiver Name 1 is required";
    const isInternalMovement = isMovement && movementType === "Internal";
    const isExternalMovement = isMovement && movementType === "External";
    if (isInternalMovement && !fromUnit.trim()) errors.fromUnit = "Select the source unit";
    if (isInternalMovement && !toUnit.trim()) errors.toUnit = "Select the destination unit";
    if (isInternalMovement && fromUnit.trim() === toUnit.trim()) errors.toUnit = "Destination must differ from source unit";
    if (!dueDate) errors.dueDate = "Return due date is required";
    if (!lobType || lobType === "-Select-") errors.lobType = "LOB Type is required";
    if ((!isMovement || isExternalMovement) && issueOption === "SubContractor" && !subCode.trim()) {
      errors.party = "Select Party Name (SubContractor)";
    }
    if ((!isMovement || isExternalMovement) && (issueOption === "Supplier" || issueOption === "Issue to Supplier") && !supCode.trim()) {
      errors.party = "Select Party Name (Supplier)";
    }
    if ((!isMovement || isExternalMovement) && issueOption === "Customer" && !custCode.trim()) {
      errors.party = "Enter Customer Code";
    }
    if (stagedLines.length === 0) errors.lines = "At least one tool line item must be added to issue slip";
    if (requisitionPending === "Yes" && !reqNo.trim()) {
      errors.reqNo = "Select a pending requisition (ERP Requisition Pending = Yes)";
    }
    const overStock = !isMovement && stagedLines.find(
      (l) => !l.maintainsSerial && (l.issueQty <= 0 || l.issueQty > l.qtyAvailable)
    );
    if (overStock) {
      errors.lines =
        overStock.qtyAvailable <= 0
          ? `No stock (AVL 0) for ${overStock.toolOrGaugeNo}. Raise Qty In on Tools Master, then issue.`
          : `Qty ${overStock.issueQty} exceeds AVL ${overStock.qtyAvailable} for ${overStock.toolOrGaugeNo}.`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.lines) toastError(errors.lines);
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
      issueOption: isInternalMovement ? "Internal Unit Movement" : isExternalMovement ? `External:${issueOption}` : issueOption,
      dcRefNo: dcRefNo || undefined,
      returnable,
      transportName: transportName || undefined,
      vehicleNo: vehicleNo || undefined,
      comments: comments || undefined,
      lobType,
      poOrderNo: poOrderNo || undefined,
      fromUnit: isInternalMovement ? fromUnit || undefined : undefined,
      issuePurpose: issuePurpose || undefined,
      matType: matType || undefined,
      requisitionPending,
      reqNo: requisitionPending === "Yes" ? reqNo.trim() : undefined,
      lines: stagedLines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        issueQty: l.issueQty,
        partNo: l.partNo || l.toolOrGaugeNo,
        machine: l.machine || undefined,
        processName: l.processName || undefined,
        serialNo: l.serialNo.trim() ? Number(l.serialNo) : undefined,
        returnable: l.returnable,
        price: l.price > 0 ? l.price : undefined,
        toUnit: isInternalMovement ? toUnit.trim() : undefined,
      })),
    };

    const res = await apiPost<{ issue: ToolsIssueHeader }>("/api/issue", payload);

    if (res.error) {
      toastError(res.error.message);
      return;
    }

    if (res.data?.issue) {
      const linkedReq =
        requisitionPending === "Yes" && reqNo.trim() ? reqNo.trim() : "";
      toastSuccess({
        title: isMovement ? "Movement created" : "Issue DC created",
        message: linkedReq
          ? `Issued against requisition ${linkedReq} to ${receiveName}.`
          : isMovement
            ? isInternalMovement
              ? `Instrument movement created from ${fromUnit} to ${toUnit}.`
              : `External instrument movement created for ${receiveName}.`
            : `Tools issued successfully to ${receiveName}.`,
        detail: `DC #${res.data.issue.dcNo}`,
      });
      handleClearForm();
      setShowCreate(false);
      if (linkedReq) {
        // Return to Requisition Pending so Issued / status refresh from write-back
        router.replace("/dashboard/transactions/requisition-pending");
        return;
      }
      router.replace(issueBasePath, { scroll: false });
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
                {isMovement ? "Instrument Movement" : "Tools Issue"}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {isMovement ? "Move individually tracked instruments between company units" : "Issue tools/gauges to department or employee (GAUGE_TOOLS_ISSUE)"}
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
                    {isMovement ? "Create Movement" : "New Issue (DC)"}
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
                label: isMovement ? "Total Movements" : "Total Issue Slips",
                value: total,
                subtext: isMovement ? "Internal movement records" : "DC vouchers generated",
                icon: FileText,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "DC Slips", type: "info" },
              },
              {
                id: "open-slips",
                label: isMovement ? "Currently Moving" : "Active Open Slips",
                value: issues.filter((i) => i.status === "OPEN" || i.status === "Active").length,
                subtext: isMovement ? "Awaiting destination receipt" : "Tools currently out on DC",
                icon: Clock,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Open", type: "info" },
              },
              {
                id: "closed-slips",
                label: isMovement ? "Received Movements" : "Closed Returns",
                value: issues.filter((i) => i.status === "CLOSED" || i.status === "Closed").length,
                subtext: isMovement ? "Completed at destination" : "Fully returned vouchers",
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
            {!isMovement && <StatusPillTabs
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
            />}

            <MasterTableCard
              toolbar={
                <>
                  <MasterSearchInput
                    id="issue-search-input"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={isMovement ? "Search movement or instrument…" : "Search DC, party…"}
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
              ) : isMovement ? (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                        {["DC No", "Receive Name", "Movement Type", "Issue Date", "Tools on DC", "Status", "Actions"].map((col) => (
                          <th key={col} className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {issues.map((issue) => {
                        const preview = issue.lines
                          .map((line) => line.toolOrGaugeNo || line.tool?.toolOrGaugeNo || line.partNo)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ");
                        const external = issue.issueOption?.startsWith("External:") ?? false;
                        const partyName = issue.subCode
                          ? subs.find((s) => s.subCode === issue.subCode)?.subName
                          : issue.supCode
                            ? suppliers.find((s) => s.supCode === issue.supCode)?.supName
                            : null;
                        return (
                          <tr key={issue.dcNo} className="hover:bg-[var(--bg-hover)]">
                            <td className="py-2.5 px-3 font-mono text-xs font-bold">{issue.dcNo}</td>
                            <td className="py-2.5 px-3 text-xs font-semibold">
                              <div>{issue.receiveName ?? "—"}</div>
                              {partyName && <div className="text-[11px] font-normal text-[var(--text-muted)] truncate max-w-[200px]">{partyName}</div>}
                            </td>
                            <td className="py-2.5 px-3 text-xs">{external ? "External" : "Internal"}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{issue.issueDate ? issue.issueDate.split("T")[0] : "—"}</td>
                            <td className="py-2.5 px-3 text-xs">
                              {issue.lines.length > 0 ? <span className="font-mono">{preview}{issue.lines.length > 3 ? "…" : ""} · {issue.lines.length}</span> : "—"}
                            </td>
                            <td className="py-2.5 px-3"><StatusBadge status={issue.status} /></td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                <button type="button" title="Open movement DC" onClick={() => setViewIssue(issue)} className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {isOpenIssue(issue.status) && (
                                  <RoleGate permission="canCreateIssue">
                                    <button type="button" title="Edit movement DC" onClick={() => openEditIssue(issue)} className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </RoleGate>
                                )}
                                <button type="button" title="Download movement DC PDF" onClick={() => void downloadMovementDc(issue.dcNo)} className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-main)]">
                  {issues.map((issue) => {
                    const sc = statusConfig[issue.status] ?? statusConfig["OPEN"];
                    const partyName = issue.subCode
                      ? subs.find((s) => s.subCode === issue.subCode)?.subName
                      : issue.supCode
                        ? suppliers.find((s) => s.supCode === issue.supCode)?.supName
                        : null;
                    return (
                      <div key={issue.dcNo} className="p-4">
                        <div className="flex items-center justify-between mb-3 gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{issue.dcNo}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {issue.receiveName ?? "—"} · Issued {issue.issueDate ? issue.issueDate.split("T")[0] : "—"} · Due {issue.dueDate ? issue.dueDate.split("T")[0] : "—"}
                              {issue.custCode ? ` · Cust ${issue.custCode}` : ""}
                              {issue.supCode ? ` · Sup ${issue.supCode}${partyName ? ` (${partyName})` : ""}` : ""}
                              {issue.subCode ? ` · Sub ${issue.subCode}${partyName ? ` (${partyName})` : ""}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMovement && (
                              <Button type="button" size="sm" variant="outline" onClick={() => void downloadMovementDc(issue.dcNo)}>
                                <Download className="h-3.5 w-3.5" />
                                Download DC
                              </Button>
                            )}
                            <RoleGate permission="canCreateIssue">
                              {isOpenIssue(issue.status) && (
                                <>
                                  <Button type="button" size="sm" variant="outline" onClick={() => openEditIssue(issue)}>
                                    Edit
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => void handleCancelIssue(issue.dcNo)} className="text-[var(--color-danger-text)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]">
                                    Cancel
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
          {viewIssue && isMovement && (
            <OverlayModal
              open
              size="xl"
              title={`Movement DC ${viewIssue.dcNo}`}
              subtitle={`${viewIssue.issueOption?.startsWith("External:") ? "External" : "Internal"} movement details`}
              onClose={() => setViewIssue(null)}
              footer={
                <>
                  <button type="button" className="form-btn-cancel" onClick={() => setViewIssue(null)}>Close</button>
                  {isOpenIssue(viewIssue.status) && (
                    <button type="button" className="form-btn-cancel" onClick={() => { const issue = viewIssue; setViewIssue(null); openEditIssue(issue); }}>
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                  )}
                  <button type="button" className="form-btn-save" onClick={() => void downloadMovementDc(viewIssue.dcNo)}>
                    <Download className="w-4 h-4" /> Download DC PDF
                  </button>
                </>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
                  <div><p className="form-label">Receive Name</p><p className="font-semibold">{viewIssue.receiveName ?? "—"}</p></div>
                  <div><p className="form-label">Movement Type</p><p className="font-semibold">{viewIssue.issueOption?.startsWith("External:") ? "External" : "Internal"}</p></div>
                  <div><p className="form-label">Issue Date</p><p className="font-mono font-semibold">{viewIssue.issueDate?.split("T")[0] ?? "—"}</p></div>
                  <div><p className="form-label">Status</p><StatusBadge status={viewIssue.status} /></div>
                  <div><p className="form-label">From Unit</p><p className="font-semibold">{viewIssue.fromUnit ?? "—"}</p></div>
                  <div><p className="form-label">Due Date</p><p className="font-mono">{viewIssue.dueDate?.split("T")[0] ?? "—"}</p></div>
                  <div><p className="form-label">Purpose</p><p>{viewIssue.issuePurpose ?? "—"}</p></div>
                  <div><p className="form-label">Vehicle No</p><p>{viewIssue.vehicleNo ?? "—"}</p></div>
                </div>
                <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-subtle)]"><tr>{["Tool No", "Name", "Group", "Serial", "Destination", "Status"].map((col) => <th key={col} className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3">{col}</th>)}</tr></thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {viewIssue.lines.map((line) => {
                        const master = line.tool ?? line.toolByRef;
                        return <tr key={line.rowId}>
                          <td className="py-2.5 px-3 font-mono text-xs font-bold">{line.toolOrGaugeNo || master?.toolOrGaugeNo || line.partNo}</td>
                          <td className="py-2.5 px-3 text-xs">{line.name || master?.name || "—"}</td>
                          <td className="py-2.5 px-3 text-xs">{line.groupName || master?.grouping || "—"}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{line.serialNo ?? "—"}</td>
                          <td className="py-2.5 px-3 text-xs">{line.issueToItemNo || viewIssue.receiveName || "—"}</td>
                          <td className="py-2.5 px-3 text-xs">{line.status ?? "—"}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </OverlayModal>
          )}
          {showCreate && (
            <OverlayModal
              open
              size="5xl"
              title={isMovement ? "Create Movement" : "Add Issue"}
              subtitle={isMovement ? "Transfer instruments between company units" : "Issue tools / gauges · DC No Auto"}
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
                {isMovement && (
                  <FormModalSection title="Movement details">
                    <div className="form-grid">
                      <div className="md:col-span-2">
                        <label className="form-label">Movement Type</label>
                        <div
                          role="group"
                          aria-label="Movement type"
                          className="grid w-full max-w-xl grid-cols-2 gap-1 rounded-xl border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900"
                        >
                          {(["Internal", "External"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              aria-pressed={movementType === type}
                              onClick={() => {
                                setMovementType(type);
                                setIssueOption(type === "Internal" ? "Internal Unit Movement" : "SubContractor");
                                setFromUnit("");
                                setToUnit("");
                                setSubCode("");
                                setSupCode("");
                                setCustCode("");
                                setFormErrors({});
                              }}
                              className={`w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                movementType === type
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-transparent text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                              }`}
                            >
                              {type} Movement
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          {movementType === "Internal" ? "Transfer between company units." : "Send to a subcontractor, supplier, or customer and track its return."}
                        </p>
                      </div>
                      <div>
                        <label className="form-label">Movement Date</label>
                        <input type="date" value={issueDate} readOnly className="form-control cursor-not-allowed opacity-80" />
                      </div>
                      <div>
                        <label className="form-label">Expected Receipt Date *</label>
                        <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setFormErrors((prev) => ({ ...prev, dueDate: "" })); }} className="form-control" />
                        {formErrors.dueDate && <p className="form-error">{formErrors.dueDate}</p>}
                      </div>
                      {movementType === "Internal" && <div>
                        <label className="form-label">From Unit *</label>
                        <select value={fromUnit} onChange={(e) => { setFromUnit(e.target.value); setFormErrors((prev) => ({ ...prev, fromUnit: "" })); }} className="form-control">
                          <option value="">Select source unit</option>
                          {COMPANY_UNITS.map((unit) => <option key={unit.key} value={unit.label}>{unit.label}</option>)}
                        </select>
                        {formErrors.fromUnit && <p className="form-error">{formErrors.fromUnit}</p>}
                      </div>}
                      {movementType === "Internal" && <div>
                        <label className="form-label">To Unit *</label>
                        <select value={toUnit} onChange={(e) => { setToUnit(e.target.value); setFormErrors((prev) => ({ ...prev, toUnit: "" })); }} className="form-control">
                          <option value="">Select destination unit</option>
                          {COMPANY_UNITS.filter((unit) => unit.label !== fromUnit).map((unit) => <option key={unit.key} value={unit.label}>{unit.label}</option>)}
                        </select>
                        {formErrors.toUnit && <p className="form-error">{formErrors.toUnit}</p>}
                      </div>}
                      {movementType === "External" && <div>
                        <label className="form-label">External Party Type</label>
                        <select value={issueOption} onChange={(e) => { setIssueOption(e.target.value); setSubCode(""); setSupCode(""); setCustCode(""); setPartyQuery(""); }} className="form-control">
                          <option value="SubContractor">Subcontractor</option>
                          <option value="Supplier">Supplier</option>
                          <option value="Customer">Customer</option>
                        </select>
                      </div>}
                      {movementType === "External" && (issueOption === "Customer" ? (
                        <div>
                          <label className="form-label">Customer Code *</label>
                          <input value={custCode} onChange={(e) => { setCustCode(e.target.value.toUpperCase()); setFormErrors((prev) => ({ ...prev, party: "" })); }} className="form-control font-mono uppercase" maxLength={12} />
                          {formErrors.party && <p className="form-error">{formErrors.party}</p>}
                        </div>
                      ) : (
                        <SearchSelect
                          label={`${issueOption === "Supplier" ? "Supplier" : "Subcontractor"} *`}
                          placeholder="Search code or name…"
                          query={partyQuery}
                          onQueryChange={setPartyQuery}
                          selected={(issueOption === "Supplier" ? supCode : subCode) ? { primary: issueOption === "Supplier" ? supCode : subCode, secondary: issueOption === "Supplier" ? suppliers.find((s) => s.supCode === supCode)?.supName : subs.find((s) => s.subCode === subCode)?.subName } : null}
                          onClear={() => { setSubCode(""); setSupCode(""); setPartyQuery(""); }}
                          items={partySelectItems}
                          onSelect={(item) => { if (issueOption === "Supplier") { setSupCode(item.id); setSubCode(""); } else { setSubCode(item.id); setSupCode(""); } setPartyQuery(""); setFormErrors((prev) => ({ ...prev, party: "" })); }}
                          error={formErrors.party}
                          emptyText="No parties match your search"
                        />
                      ))}
                      <div>
                        <label className="form-label">Receiver / Responsible Person *</label>
                        <input value={receiveName} onChange={(e) => setReceiveName(e.target.value)} className="form-control" maxLength={50} placeholder="Name at destination unit" />
                        {formErrors.receiveName && <p className="form-error">{formErrors.receiveName}</p>}
                      </div>
                      {movementType === "External" && <>
                        <div>
                          <label className="form-label">Returnable</label>
                          <select value={returnable} onChange={(e) => setReturnable(e.target.value as "Yes" | "No")} className="form-control"><option value="Yes">Yes</option><option value="No">No</option></select>
                        </div>
                        <div>
                          <label className="form-label">Reference / Challan No.</label>
                          <input value={dcRefNo} onChange={(e) => setDcRefNo(e.target.value)} className="form-control" maxLength={20} />
                        </div>
                        <div>
                          <label className="form-label">Transporter</label>
                          <input value={transportName} onChange={(e) => setTransportName(e.target.value)} className="form-control" maxLength={50} />
                        </div>
                        <div>
                          <label className="form-label">Vehicle No.</label>
                          <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="form-control" maxLength={25} />
                        </div>
                        <div>
                          <label className="form-label">PO Number</label>
                          <input value={poOrderNo} onChange={(e) => setPoOrderNo(e.target.value)} className="form-control" maxLength={15} />
                        </div>
                      </>}
                      <div>
                        <label className="form-label">Purpose</label>
                        <input value={issuePurpose} onChange={(e) => setIssuePurpose(e.target.value)} className="form-control" maxLength={100} placeholder="Reason for movement" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">Comments</label>
                        <textarea value={comments} onChange={(e) => setComments(e.target.value)} maxLength={100} rows={2} className="form-control h-auto resize-y py-2" />
                      </div>
                    </div>
                  </FormModalSection>
                )}
                <div className={isMovement ? "hidden" : "contents"}>
                <FormModalSection title="Requisition Pending (ERP)">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Requisition Pending?</label>
                      <select
                        value={requisitionPending}
                        disabled={reqLinkLocked}
                        onChange={(e) => {
                          const v = e.target.value as "Yes" | "No";
                          setRequisitionPending(v);
                          if (v === "No") {
                            setReqNo("");
                            setFormErrors((prev) => ({ ...prev, reqNo: "" }));
                          } else {
                            void loadPendingRequisitions();
                          }
                        }}
                        className="form-control"
                        title="ERP: Yes = Issue For Tools against a pending Material Requisition"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        Same as ERP <span className="font-semibold">Requisition Pending for Tools</span> → Issue For Tools.
                      </p>
                    </div>
                    {requisitionPending === "Yes" && (
                      <div className="sm:col-span-2">
                        <label className="form-label">Req No *</label>
                        <select
                          value={reqNo}
                          onChange={(e) => {
                            const v = e.target.value;
                            setReqNo(v);
                            setFormErrors((prev) => ({ ...prev, reqNo: "" }));
                            if (v) void stageToolsFromRequisition(v);
                          }}
                          className="form-control font-mono"
                          disabled={loadingPendingReqs || reqLinkLocked}
                        >
                          <option value="">
                            {loadingPendingReqs ? "Loading pending requisitions…" : "— Select OPEN requisition —"}
                          </option>
                          {reqNo &&
                            !pendingReqs.some((r) => r.reqNo === reqNo) && (
                              <option value={reqNo}>{reqNo}</option>
                            )}
                          {pendingReqs.map((r) => (
                            <option key={r.reqNo} value={r.reqNo}>
                              {r.reqNo}
                              {r.reqDate ? ` · ${String(r.reqDate).split("T")[0]}` : ""}
                              {r.deptId != null ? ` · Dept ${r.deptId}` : ""}
                              {r.headerStatus ? ` · ${r.headerStatus}` : ""}
                            </option>
                          ))}
                        </select>
                        {formErrors.reqNo && <p className="form-error">{formErrors.reqNo}</p>}
                        {pendingReqs.length === 0 && !loadingPendingReqs && (
                          <p className="text-[11px] text-[var(--color-warning-text)] mt-1">
                            No OPEN pending requisitions with tool lines. Raise an MR in ERP or open Requisition Pending.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </FormModalSection>

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
                </div>

                <FormModalSection
                  title={isMovement ? "Instruments to move" : "Tool line items"}
                  action={
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      {stagedLines.length} staged · qty {stagedLines.reduce((sum, l) => sum + l.issueQty, 0)}
                    </span>
                  }
                >
                  <p className="text-xs text-[var(--text-muted)] -mt-1">
                    {isMovement
                      ? "Search and select an instrument. Each instrument is treated as one tracked asset; movement does not split stock by unit."
                      : "Search an in-stock tool, then click to add a line. Same tool increases qty (up to Available). Stock reduces only when serial numbers are not maintained."}
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
                        : `No ${isMovement ? "instruments" : "in-stock tools"} match “${searchVal}”`
                    }
                    error={formErrors.lines}
                  />

                  <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          {["#", "Item No", "Description", "Size", "Qty", "Avl", "Price", "Amount", "Machine", "Part No", "Process", "Ret.?", "Sl.No", ""].map((col) => (
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
                            <td className="py-2 px-3 text-xs font-mono whitespace-nowrap">{line.size || "—"}</td>
                            <td className="py-2 px-3">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Decrease qty"
                                  disabled={isMovement || line.issueQty <= 1}
                                  onClick={() => bumpQty(idx, -1)}
                                  className="w-6 h-6 rounded-md border border-[var(--border-main)] text-xs font-bold disabled:opacity-40 hover:bg-[var(--bg-hover)]"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={isMovement ? 1 : line.maintainsSerial ? undefined : line.qtyAvailable}
                                  value={line.issueQty}
                                  readOnly={isMovement}
                                  onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                                  className="w-14 text-center text-xs border border-[var(--border-main)] rounded-lg py-1 bg-[var(--bg-card)] font-mono font-semibold"
                                />
                                <button
                                  type="button"
                                  aria-label="Increase qty"
                                  disabled={isMovement || (!line.maintainsSerial && line.issueQty >= line.qtyAvailable)}
                                  onClick={() => bumpQty(idx, 1)}
                                  className="w-6 h-6 rounded-md border border-[var(--border-main)] text-xs font-bold disabled:opacity-40 hover:bg-[var(--bg-hover)]"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-xs text-[var(--color-success-text)] font-bold">
                              {isMovement ? "Single" : line.maintainsSerial ? "Serial" : line.qtyAvailable}
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
                            <td colSpan={14} className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
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
                {isMovement && (
                  <FormModalSection title="Instruments on movement DC">
                    <div className="space-y-2">
                      <div>
                        <label className="form-label">Add instrument</label>
                        <input
                          className="form-control"
                          value={searchVal}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSearchVal(value);
                            if (toolSearchTimer.current) clearTimeout(toolSearchTimer.current);
                            toolSearchTimer.current = setTimeout(() => void fetchToolsForSearch(value), 300);
                          }}
                          placeholder="Type at least 2 characters…"
                        />
                      </div>
                      {searchVal.trim().length >= 2 && searchResults.length > 0 && (
                        <div className="max-h-32 overflow-auto border border-[var(--border-main)] rounded-lg divide-y divide-[var(--border-main)]">
                          {searchResults.filter((tool) => !editMovementLines.some((line) => line.toolOrGaugeNo === tool.toolOrGaugeNo)).map((tool) => (
                            <button
                              key={tool.refNo}
                              type="button"
                              className="w-full flex items-center justify-between p-2 text-left hover:bg-[var(--bg-hover)]"
                              onClick={() => {
                                const sourceUnit = normalizeCompanyUnit(tool.locationName);
                                if (movementType === "Internal" && sourceUnit !== normalizeCompanyUnit(fromUnit)) {
                                  setFormErrors({ lines: `${tool.toolOrGaugeNo} does not belong to ${fromUnit}.` });
                                  return;
                                }
                                setEditMovementLines((current) => [...current, {
                                  toolOrGaugeNo: tool.toolOrGaugeNo,
                                  name: tool.name || tool.toolOrGaugeNo,
                                  serialNo: null,
                                  toUnit: movementType === "Internal" ? toUnit : null,
                                }]);
                                setSearchVal("");
                                setTools([]);
                                setFormErrors((current) => ({ ...current, lines: "" }));
                              }}
                            >
                              <span className="font-mono text-xs font-semibold">{tool.toolOrGaugeNo}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {tool.name}{tool.size ? ` · Size: ${tool.size}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {movementType === "Internal" && (
                        <div>
                          <label className="form-label">Destination for newly added instruments</label>
                          <select className="form-control" value={toUnit} onChange={(event) => setToUnit(event.target.value)}>
                            <option value="">Select destination…</option>
                            {COMPANY_UNITS.filter((unit) => unit.label !== normalizeCompanyUnit(fromUnit)).map((unit) => <option key={unit.key} value={unit.label}>{unit.label}</option>)}
                          </select>
                        </div>
                      )}
                      {formErrors.lines && <p className="form-error">{formErrors.lines}</p>}
                      <div className="max-h-56 overflow-auto border border-[var(--border-main)] rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--bg-subtle)]"><tr><th className="text-left p-2">Instrument</th><th className="text-left p-2">Name</th><th className="text-left p-2">Destination</th><th className="w-10" /></tr></thead>
                          <tbody className="divide-y divide-[var(--border-main)]">
                            {editMovementLines.map((line) => (
                              <tr key={line.rowId ?? line.toolOrGaugeNo}>
                                <td className="p-2 font-mono font-semibold">{line.toolOrGaugeNo}</td>
                                <td className="p-2">{line.name}</td>
                                <td className="p-2">{line.toUnit ?? (movementType === "Internal" ? toUnit : "External")}</td>
                                <td className="p-1"><button type="button" title="Remove line" className="p-1 text-red-600" onClick={() => setEditMovementLines((current) => current.filter((item) => item !== line))}><Trash className="w-4 h-4" /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </FormModalSection>
                )}
              </form>
            </OverlayModal>
          )}
        </main>
      </div>
    </div>
  );
}
