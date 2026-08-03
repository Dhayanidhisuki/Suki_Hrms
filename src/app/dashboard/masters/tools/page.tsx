"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Trash2,
  ArrowLeft,
  Trash,
  Save,
  HelpCircle,
  CheckCircle2,
  Cog,
  Wrench,
  Eye,
  Edit2,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  X,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { useSearchParams } from "next/navigation";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import { ERP_COMPANY_UNITS, ERP_ISSUE_TYPES } from "@/lib/toolCreate";

type TabId = "general" | "stock" | "calibration" | "preventive" | "specs";

interface GaugeAndTool {
  refNo: number;
  toolOrGaugeNo: string;
  name: string;
  description: string | null;
  size: string | null;
  shape: string | null;
  range?: string | null;
  grouping: string;
  type: string | null;
  companyId?: string | null;
  serialNoGenReq: string | null;
  totQty: number | string;
  qtyIn: number | string;
  qtyOut: number | string;
  qtyNew: number | string;
  qtyInUse?: number | string | null;
  location: string | null;
  locationName?: string | null;
  locationOutputName?: string | null;
  area?: string | null;
  rack?: string | null;
  deptName?: string | null;
  issueType?: string | null;
  oldItemNo?: string | null;
  price?: number | string | null;
  minOrderLevel?: number | string | null;
  hsnCode?: string | null;
  drawingNo?: string | null;
  revNoDt?: string | null;
  detailedSpec?: string | null;
  packingLength?: string | null;
  packingWidth?: string | null;
  packingHeight?: string | null;
  packingDimensions?: string | null;
  stiffness?: string | null;
  selfLife?: number | null;
  activeItem?: string | null;
  criticalItem?: string | null;
  poReq?: string | null;
  stockReq?: string | null;
  stockItem?: string | null;
  isAsset?: string | null;
  saleableItem?: string | null;
  nocReq?: string | null;
  machineSoftware?: string | null;
  ineligibleForItc?: string | null;
  isCustGiven?: string | null;
  historyCardReq?: string | null;
  status: string | null;
  calibrationFrqMonths: number | null;
  caliPlannedWho?: string | null;
  calibrationResponsibility?: string | null;
  preventiveMethod?: string | null;
  preventiveFrqMonths?: number | null;
  gSpecUpperMin?: number | string | null;
  gSpecUpperMax?: number | string | null;
  wLimitLowerMax?: number | string | null;
  wLimitUpperMin?: number | string | null;
  wLimitUpperMax?: number | string | null;
  prodSpecLowerMax?: number | string | null;
  prodSpecUpperMin?: number | string | null;
  prodSpecUpperMax?: number | string | null;
  uom?: string | null;
  returnable?: string | null;
  leastCount?: string | null;
  /** Roll-up computed server-side from GAUGE_SERIAL_NO unit statuses. */
  computedStatus?: string;
  /** Machine codes mapped via TOOLS_MACHINE_TRANS. */
  machines?: string[];
  serialNumbers?: {
    refNo: number;
    serialNo: number | null;
    status: string | null;
    make?: string | null;
    purchaseDt?: string | null;
    nextPreDate?: string | null;
  }[];
  unitHistory?: UnitHistoryRow[];
  specifications?: { parameter: string | null; specification: string | null; minRange?: string | null }[];
  calibControlCard?: {
    status?: string | null;
    history?: { cDate?: string | null; nextCDate?: string | null; remarks?: string | null }[];
  } | null;
}

interface ToolsGroup {
  id?: number;
  rowId?: number;
  code: string;
  name: string;
  prefixToolsNo: string | null;
}

interface ToolsSubgroup {
  id?: number;
  rowId?: number;
  code: string;
  name: string;
  refGroupId: number | null;
  prefixToolsNo?: string | null;
  isAutoGenCd?: string | null;
  prefixBased?: string | null;
  assetCategory?: string | null;
  group?: { name: string; prefixToolsNo?: string | null } | null;
}

interface LocationOption {
  id: number;
  locationName: string | null;
  area: string | null;
  rack: string | null;
}

interface ToolSpec {
  name: string;
  value: string;
  unit: string;
}

/** Serializable snapshot of the create/edit form for dirty checking. */
type ToolFormSnapshot = Record<string, unknown>;

type LeaveTarget = "list" | "view";

function buildFormSnapshot(fields: ToolFormSnapshot): string {
  return JSON.stringify(fields);
}

interface UnitHistoryRow {
  key: string;
  refNo?: number;
  serialNo: string;
  status: string;
  make: string;
  purchaseDt: string;
  lastCaliDt: string;
  nextCaliDt: string;
  lastPreMntDt?: string;
  nextPreMntDt?: string;
  issueTo?: string;
  dcNo?: string;
  dcDate?: string;
}

type TypeProfile = "gauge" | "form" | "consumable" | "preventive" | "generic";

/**
 * Badge styles for the per-tool status roll-up computed server-side from
 * GAUGE_SERIAL_NO unit rows (GAUGEANDTOOLS.STATUS is never used — it carries
 * no lifecycle signal in the ERP data).
 */
const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  "In Calibration": { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]", dot: "bg-amber-500" },
  "Needs Attention": { bg: "bg-[var(--color-danger-bg)] border border-[var(--border-main)]", text: "text-[var(--color-danger-text)]", dot: "bg-red-500" },
  Available: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]", dot: "bg-emerald-500" },
  "In Use": { bg: "bg-[var(--primary-light)] border border-[var(--border-main)]", text: "text-[var(--primary)]", dot: "bg-[var(--primary)]" },
  Inactive: { bg: "bg-[var(--bg-subtle)] border border-[var(--border-main)]", text: "text-[var(--text-muted)]", dot: "bg-slate-400" },
  "No Units": { bg: "bg-[var(--bg-subtle)] border border-[var(--border-main)]", text: "text-[var(--text-muted)]", dot: "bg-slate-300" },
};

const ROLLUP_STATUSES = [
  "In Calibration",
  "Needs Attention",
  "Available",
  "In Use",
  "Inactive",
  "No Units",
] as const;

const YES_NO = ["Yes", "No"] as const;
const CALI_PLANNED_OPTIONS = ["N/A", "Internal", "External"] as const;
const CALI_RESP_OPTIONS = ["N/A", "Internal", "External"] as const;
const PREV_METHOD_OPTIONS = ["N/A", "Qty", "Internal", "External"] as const;

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function num(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN");
}

function resolveTypeProfile(type: string, group: string, assetCategory?: string | null): TypeProfile {
  const source = `${normalizeText(type)} ${normalizeText(group)} ${normalizeText(assetCategory)}`;
  if (
    ["insert", "consumable", "general consumable", "spare", "stationery"].some((k) => source.includes(k)) ||
    normalizeText(group) === "general consumables"
  ) {
    return "consumable";
  }
  if (["form tool", "form tools", "cutting", "punch", "die"].some((k) => source.includes(k))) {
    return "form";
  }
  if (
    ["gauge", "meter", "mic", "caliper", "dial", "instrument", "tester", "thermometer", "probe", "measuring"].some((k) =>
      source.includes(k)
    )
  ) {
    return "gauge";
  }
  if (["capital", "asset", "maint", "machine", "equipment", "fixture", "jig", "preventive"].some((k) => source.includes(k))) {
    return "preventive";
  }
  return "generic";
}

function yesNoValue(value: string | null | undefined, fallback = "No") {
  if (!value) return fallback;
  const v = value.trim().toUpperCase();
  if (v === "Y" || v === "YES") return "Yes";
  if (v === "N" || v === "NO") return "No";
  return value;
}

function buildUnitHistoryRows(tool: GaugeAndTool): UnitHistoryRow[] {
  if (tool.unitHistory && tool.unitHistory.length > 0) {
    return tool.unitHistory.map((row) => ({
      ...row,
      refNo: row.refNo,
      purchaseDt: row.purchaseDt || "—",
      lastCaliDt: row.lastCaliDt || "—",
      nextCaliDt: row.nextCaliDt || "—",
      lastPreMntDt: row.lastPreMntDt || "—",
      nextPreMntDt: row.nextPreMntDt || "—",
      issueTo: row.issueTo || "—",
      dcNo: row.dcNo || "—",
      dcDate: row.dcDate || "—",
    }));
  }
  const latestHistory = tool.calibControlCard?.history?.[0];
  const serials = tool.serialNumbers ?? [];
  if (serials.length === 0) return [];
  return serials.map((s) => ({
    key: String(s.refNo),
    refNo: s.refNo,
    serialNo: s.serialNo != null ? String(s.serialNo) : "—",
    status: s.status || "—",
    make: s.make || "—",
    purchaseDt: formatDate(s.purchaseDt),
    lastCaliDt: formatDate(latestHistory?.cDate),
    nextCaliDt: formatDate(latestHistory?.nextCDate),
    lastPreMntDt: "—",
    nextPreMntDt: formatDate(s.nextPreDate),
    issueTo: "—",
    dcNo: "—",
    dcDate: "—",
  }));
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] placeholder-[var(--text-muted)] disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)] ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] font-medium disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed ${props.className ?? ""}`}
    />
  );
}

export default function ToolsMasterPage() {
  const { showSuccess } = useSuccessOverlay();
  const [tools, setTools] = useState<GaugeAndTool[]>([]);
  const [toolsGroups, setToolsGroups] = useState<ToolsGroup[]>([]);
  const [toolsSubgroups, setToolsSubgroups] = useState<ToolsSubgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [viewState, setViewState] = useState<"list" | "create" | "edit" | "view">("list");
  const [selectedTool, setSelectedTool] = useState<GaugeAndTool | null>(null);
  const [successMessage, setSuccessBanner] = useState("");
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [specs, setSpecs] = useState<ToolSpec[]>([]);
  const [unitRows, setUnitRows] = useState<UnitHistoryRow[]>([]);
  const [serialPreview, setSerialPreview] = useState<string[]>([]);
  const [showSerialPreview, setShowSerialPreview] = useState(false);
  const [unitForm, setUnitForm] = useState({
    serialNo: "",
    make: "",
    purchaseDt: "",
    nextPreDate: "",
    status: "AVAILABLE FOR USE",
  });
  const [unitSaving, setUnitSaving] = useState(false);
  const [exportBusy, setExportBusy] = useState<"xlsx" | "pdf" | "template" | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [importBusy, setImportBusy] = useState<"preview" | "confirm" | null>(null);
  const [importTemplate, setImportTemplate] = useState<"basic" | "full" | "price" | null>(null);
  const [showImportChooser, setShowImportChooser] = useState(false);
  const [selectedRefNos, setSelectedRefNos] = useState<number[]>([]);
  const [machineModalTool, setMachineModalTool] = useState<GaugeAndTool | null>(null);
  const [machineItems, setMachineItems] = useState<Array<{ rowId: number; macCode: string | null; creatDt: string | null }>>([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const [machineCode, setMachineCode] = useState("");
  const [machineSaving, setMachineSaving] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    template: "basic" | "full" | "price";
    createCount: number;
    updateCount: number;
    rejectCount: number;
    rejected: Array<{ row: number; reason: string }>;
    pendingRows: Array<Record<string, unknown>>;
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const formBaselineRef = useRef("");
  const [leavePrompt, setLeavePrompt] = useState<LeaveTarget | null>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [formEntryKey, setFormEntryKey] = useState("");

  // Core
  const [toolOrGaugeNo, setToolOrGaugeNo] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState("");
  const [shape, setShape] = useState("");
  const [range, setRange] = useState("");
  const [grouping, setGrouping] = useState("");
  const [type, setType] = useState("");
  const [issueType, setIssueType] = useState<string>(ERP_ISSUE_TYPES[0]);
  const [oldItemNo, setOldItemNo] = useState("");
  const [drawingNo, setDrawingNo] = useState("");
  const [revNoDt, setRevNoDt] = useState("");
  const [location, setLocation] = useState("");
  const [locationName, setLocationName] = useState("");
  const [area, setArea] = useState("");
  const [rack, setRack] = useState("");
  const [deptName, setDeptName] = useState("");
  const [companyId, setCompanyId] = useState<string>("All");
  const [leastCount, setLeastCount] = useState("");
  const [toolNoLocked, setToolNoLocked] = useState(false);

  // Stock & flags
  const [serialNoGenReq, setSerialNoGenReq] = useState(false);
  const [totQty, setTotQty] = useState(0);
  const [qtyIn, setQtyIn] = useState(0);
  const [qtyOut, setQtyOut] = useState(0);
  const [qtyNew, setQtyNew] = useState(0);
  const [uom, setUom] = useState("Nos");
  const [price, setPrice] = useState(0);
  const [minOrderLevel, setMinOrderLevel] = useState(0);
  const [hsnCode, setHsnCode] = useState("");
  const [returnable, setReturnable] = useState("No");
  const [activeItem, setActiveItem] = useState("Yes");
  const [criticalItem, setCriticalItem] = useState("No");
  const [poReq, setPoReq] = useState("Yes");
  const [stockReq, setStockReq] = useState("Yes");
  const [isAsset, setIsAsset] = useState("No");
  const [saleableItem, setSaleableItem] = useState("No");
  const [nocReq, setNocReq] = useState("Yes");
  const [machineSoftware, setMachineSoftware] = useState("No");
  const [ineligibleForItc, setIneligibleForItc] = useState("No");
  const [isCustGiven, setIsCustGiven] = useState("No");

  // Technical
  const [detailedSpec, setDetailedSpec] = useState("");
  const [packingLength, setPackingLength] = useState("");
  const [packingWidth, setPackingWidth] = useState("");
  const [packingHeight, setPackingHeight] = useState("");
  const [packingDimensions, setPackingDimensions] = useState("");
  const [stiffness, setStiffness] = useState("");
  const [selfLife, setSelfLife] = useState(0);

  // Calibration / Preventive
  const [calibrationFrqMonths, setCalibrationFrqMonths] = useState(0);
  const [caliPlannedWho, setCaliPlannedWho] = useState("N/A");
  const [calibrationResponsibility, setCalibrationResponsibility] = useState("N/A");
  const [historyCardReq, setHistoryCardReq] = useState("No");
  const [preventiveMethod, setPreventiveMethod] = useState("N/A");
  const [preventiveFrqMonths, setPreventiveFrqMonths] = useState(0);
  const [gSpecUpperMin, setGSpecUpperMin] = useState(0);
  const [gSpecUpperMax, setGSpecUpperMax] = useState(0);
  const [wLimitLowerMax, setWLimitLowerMax] = useState(0);
  const [wLimitUpperMin, setWLimitUpperMin] = useState(0);
  const [wLimitUpperMax, setWLimitUpperMax] = useState(0);
  const [prodSpecLowerMax, setProdSpecLowerMax] = useState(0);
  const [prodSpecUpperMin, setProdSpecUpperMin] = useState(0);
  const [prodSpecUpperMax, setProdSpecUpperMax] = useState(0);

  const searchParams = useSearchParams();

  const loadTools = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (groupFilter !== "All") params.set("grouping", groupFilter);
    if (statusFilter !== "All") params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await apiGet<{ items: GaugeAndTool[]; total?: number }>(`/api/tools?${params}`);
    if (res.data?.items) setTools(res.data.items);
    else setTools([]);
    setTotal(res.data?.total ?? 0);
    setLoading(false);
  }, [query, groupFilter, statusFilter, page, pageSize]);

  const [toolNames, setToolNames] = useState<
    Array<{ id: number; name: string; itemGroupId: number | null; itemTypeId: number | null; typeName: string; groupName: string }>
  >([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string | null }>>([]);

  const loadLookups = useCallback(async () => {
    const [gr, sg, names, locs, uoms, depts] = await Promise.all([
      apiGet<{ items: ToolsGroup[] }>("/api/lookups/groups"),
      apiGet<{ items: ToolsSubgroup[] }>("/api/lookups/subgroups"),
      apiGet<{
        items: Array<{ id: number; name: string; itemGroupId: number | null; itemTypeId: number | null; typeName: string; groupName: string }>;
      }>("/api/lookups/tool-types"),
      apiGet<{ items: LocationOption[] }>("/api/lookups/locations"),
      apiGet<{ items: Array<{ uom: string }> }>("/api/lookups/uom"),
      apiGet<{ items: Array<{ id: number; name: string | null }> }>("/api/lookups/departments"),
    ]);
    if (gr.data?.items) setToolsGroups(gr.data.items);
    if (sg.data?.items) setToolsSubgroups(sg.data.items);
    if (names.data?.items) setToolNames(names.data.items);
    if (locs.data?.items) setLocations(locs.data.items);
    if (uoms.data?.items) setUomOptions(uoms.data.items.map((u) => u.uom).filter(Boolean));
    if (depts.data?.items) setDepartments(depts.data.items);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTools();
  }, [loadTools]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLookups();
  }, [loadLookups]);

  const selectedGroupId =
    toolsGroups.find((g) => g.name === grouping)?.rowId ??
    toolsGroups.find((g) => g.name === grouping)?.id ??
    null;

  const filteredTypes = toolsSubgroups.filter((sg) => {
    if (!selectedGroupId) return true;
    return sg.refGroupId === selectedGroupId || sg.group?.name === grouping;
  });

  const selectedTypeId =
    filteredTypes.find((t) => t.name === type)?.rowId ??
    filteredTypes.find((t) => t.name === type)?.id ??
    null;

  const filteredNames = toolNames.filter((n) => {
    if (selectedTypeId && n.itemTypeId === selectedTypeId) return true;
    if (selectedGroupId && n.itemGroupId === selectedGroupId && (!type || n.typeName === type)) return true;
    if (!selectedTypeId && !selectedGroupId) return true;
    return n.groupName === grouping && (!type || n.typeName === type);
  });

  const suggestToolNumber = useCallback(async () => {
    if (viewState !== "create" || toolNoLocked) return;
    const matchedGroup = toolsGroups.find((g) => g.name === grouping);
    const matchedType = toolsSubgroups.find(
      (sg) =>
        sg.name === type && (!selectedGroupId || sg.refGroupId === selectedGroupId)
    );
    const groupPrefix = matchedGroup?.prefixToolsNo ?? "";
    const typePrefix = matchedType?.prefixToolsNo ?? "";
    if (!groupPrefix && !typePrefix) return;

    const params = new URLSearchParams();
    if (groupPrefix) params.set("groupPrefix", groupPrefix);
    if (typePrefix) params.set("typePrefix", typePrefix);
    if (matchedType?.prefixBased) params.set("prefixBased", matchedType.prefixBased);
    if (matchedType?.isAutoGenCd) params.set("isAutoGenCd", matchedType.isAutoGenCd);

    const res = await apiGet<{ toolOrGaugeNo: string }>(
      "/api/tools/next-number?" + params.toString()
    );
    if (res.data?.toolOrGaugeNo) {
      setToolOrGaugeNo(res.data.toolOrGaugeNo);
    }
  }, [
    viewState,
    toolNoLocked,
    toolsGroups,
    toolsSubgroups,
    grouping,
    type,
    selectedGroupId,
  ]);

  useEffect(() => {
    if (viewState === "create" && grouping) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void suggestToolNumber();
    }
  }, [grouping, type, viewState, suggestToolNumber]);

  const resetForm = useCallback(() => {
    setToolOrGaugeNo("");
    setToolNoLocked(false);
    setName("");
    setDescription("");
    setSize("");
    setShape("");
    setRange("");
    setGrouping(toolsGroups[0]?.name ?? "");
    setType("");
    setIssueType(ERP_ISSUE_TYPES[0]);
    setOldItemNo("");
    setDrawingNo("");
    setRevNoDt("");
    setLocation("");
    setLocationName("");
    setArea("");
    setRack("");
    setDeptName("");
    setCompanyId("All");
    setLeastCount("");
    setSerialNoGenReq(false);
    // Default stock so Tool Issue picker (qtyIn > 0) works immediately after create
    setTotQty(1);
    setQtyIn(0);
    setQtyOut(0);
    setQtyNew(0);
    setUom("Nos");
    setPrice(0);
    setMinOrderLevel(0);
    setHsnCode("");
    setReturnable("No");
    setActiveItem("Yes");
    setCriticalItem("No");
    setPoReq("Yes");
    setStockReq("Yes");
    setIsAsset("No");
    setSaleableItem("No");
    setNocReq("Yes");
    setMachineSoftware("No");
    setIneligibleForItc("No");
    setIsCustGiven("No");
    setDetailedSpec("");
    setPackingLength("");
    setPackingWidth("");
    setPackingHeight("");
    setPackingDimensions("");
    setStiffness("");
    setSelfLife(0);
    setCalibrationFrqMonths(0);
    setCaliPlannedWho("N/A");
    setCalibrationResponsibility("N/A");
    setHistoryCardReq("No");
    setPreventiveMethod("N/A");
    setPreventiveFrqMonths(0);
    setGSpecUpperMin(0);
    setGSpecUpperMax(0);
    setWLimitLowerMax(0);
    setWLimitUpperMin(0);
    setWLimitUpperMax(0);
    setProdSpecLowerMax(0);
    setProdSpecUpperMin(0);
    setProdSpecUpperMax(0);
    setSpecs([]);
    setUnitRows([]);
    setShowSerialPreview(false);
    setErrors({});
    setActiveTab("general");
  }, [toolsGroups]);

  const fillForm = (tool: GaugeAndTool) => {
    setSelectedTool(tool);
    setToolOrGaugeNo(tool.toolOrGaugeNo);
    setToolNoLocked(true);
    setName(tool.name);
    setDescription(tool.description ?? "");
    setSize(tool.size ?? "");
    setShape(tool.shape ?? "");
    setRange(tool.range ?? "");
    setGrouping(tool.grouping);
    setType(tool.type ?? "");
    setIssueType(
      tool.issueType && (ERP_ISSUE_TYPES as readonly string[]).includes(tool.issueType)
        ? tool.issueType
        : ERP_ISSUE_TYPES[0]
    );
    setOldItemNo(tool.oldItemNo ?? "");
    setDrawingNo(tool.drawingNo ?? "");
    setRevNoDt(tool.revNoDt ?? "");
    setLocation(tool.location ?? "");
    setLocationName(
      tool.locationName && tool.locationName !== "-Select-" ? tool.locationName : ""
    );
    setArea(tool.area && tool.area !== "-Select-" ? tool.area : "");
    setRack(tool.rack && tool.rack !== "-Select-" ? tool.rack : "");
    setDeptName((tool.deptName ?? "").trim());
    setCompanyId(tool.companyId || "All");
    setLeastCount(tool.leastCount ?? "");
    setSerialNoGenReq(tool.serialNoGenReq === "Y" || tool.serialNoGenReq === "Yes");
    setTotQty(num(tool.totQty, 0));
    setQtyIn(num(tool.qtyIn));
    setQtyOut(num(tool.qtyOut));
    setQtyNew(num(tool.qtyNew));
    setUom(tool.uom ?? "Nos");
    setPrice(num(tool.price));
    setMinOrderLevel(num(tool.minOrderLevel));
    setHsnCode(tool.hsnCode && tool.hsnCode !== "-Select-" ? tool.hsnCode : "");
    setReturnable(yesNoValue(tool.returnable, "No"));
    setActiveItem(yesNoValue(tool.activeItem, "Yes"));
    setCriticalItem(yesNoValue(tool.criticalItem));
    setPoReq(yesNoValue(tool.poReq, "Yes"));
    setStockReq(yesNoValue(tool.stockReq, "Yes"));
    setIsAsset(yesNoValue(tool.isAsset));
    setSaleableItem(yesNoValue(tool.saleableItem));
    setNocReq(yesNoValue(tool.nocReq, "Yes"));
    setMachineSoftware(yesNoValue(tool.machineSoftware));
    setIneligibleForItc(yesNoValue(tool.ineligibleForItc));
    setIsCustGiven(yesNoValue(tool.isCustGiven));
    setDetailedSpec(tool.detailedSpec ?? "");
    setPackingLength(tool.packingLength ?? "");
    setPackingWidth(tool.packingWidth ?? "");
    setPackingHeight(tool.packingHeight ?? "");
    setPackingDimensions(tool.packingDimensions ?? "");
    setStiffness(tool.stiffness && tool.stiffness !== "-Select-" ? tool.stiffness : "");
    setSelfLife(tool.selfLife ?? 0);
    setCalibrationFrqMonths(tool.calibrationFrqMonths ?? 0);
    setCaliPlannedWho(tool.caliPlannedWho ?? "N/A");
    setCalibrationResponsibility(tool.calibrationResponsibility ?? "N/A");
    setHistoryCardReq(yesNoValue(tool.historyCardReq));
    setPreventiveMethod(tool.preventiveMethod ?? "N/A");
    setPreventiveFrqMonths(tool.preventiveFrqMonths ?? 0);
    setGSpecUpperMin(num(tool.gSpecUpperMin));
    setGSpecUpperMax(num(tool.gSpecUpperMax));
    setWLimitLowerMax(num(tool.wLimitLowerMax));
    setWLimitUpperMin(num(tool.wLimitUpperMin));
    setWLimitUpperMax(num(tool.wLimitUpperMax));
    setProdSpecLowerMax(num(tool.prodSpecLowerMax));
    setProdSpecUpperMin(num(tool.prodSpecUpperMin));
    setProdSpecUpperMax(num(tool.prodSpecUpperMax));
    setSpecs(
      (tool.specifications ?? []).map((s) => ({
        name: s.parameter ?? "",
        value: s.specification ?? "",
        unit: s.minRange ?? "",
      }))
    );
    setUnitRows(buildUnitHistoryRows(tool));
    setShowSerialPreview(false);
    setErrors({});
    setActiveTab("general");
  };

  const handleRowClick = async (tool: GaugeAndTool) => {
    const detail = await apiGet<{ tool: GaugeAndTool }>(`/api/tools/${tool.refNo}`);
    const toolData = detail.data?.tool ?? tool;
    fillForm(toolData);
    setSelectedTool(toolData);
    setViewState("view");
  };

  const syncToolMachinesInList = (refNo: number, codes: string[]) => {
    setTools((prev) =>
      prev.map((t) => (t.refNo === refNo ? { ...t, machines: codes } : t))
    );
  };

  const openMachineModal = async (tool: GaugeAndTool) => {
    setMachineModalTool(tool);
    setMachineCode("");
    setMachineError(null);
    setMachineLoading(true);
    const res = await apiGet<{ items?: Array<{ rowId: number; macCode: string | null; creatDt: string | Date | null }> }>(
      `/api/tools/${tool.refNo}/machines`
    );
    const items = (res.data?.items ?? []).map((m) => ({
      rowId: m.rowId,
      macCode: m.macCode,
      creatDt: m.creatDt ? String(m.creatDt) : null,
    }));
    setMachineItems(items);
    syncToolMachinesInList(
      tool.refNo,
      items.map((m) => m.macCode).filter((c): c is string => Boolean(c))
    );
    setMachineLoading(false);
  };

  const handleAddMachine = async () => {
    if (!machineModalTool) return;
    const code = machineCode.trim();
    if (!code) {
      setMachineError("Enter a machine code");
      return;
    }
    setMachineSaving(true);
    setMachineError(null);
    const res = await apiPost<{ assignment?: { rowId: number; macCode: string | null; creatDt: string | Date | null } }>(
      `/api/tools/${machineModalTool.refNo}/machines`,
      { macCode: code }
    );
    setMachineSaving(false);
    if (res.error) {
      setMachineError(res.error.message);
      return;
    }
    setMachineCode("");
    await openMachineModal(machineModalTool);
    showSuccess("Machine mapped");
  };

  const handleRemoveMachine = async (macCode: string) => {
    if (!machineModalTool) return;
    if (!confirm(`Remove machine ${macCode} from this tool?`)) return;
    setMachineSaving(true);
    setMachineError(null);
    const res = await apiDelete(`/api/tools/${machineModalTool.refNo}/machines?macCode=${encodeURIComponent(macCode)}`);
    setMachineSaving(false);
    if (res.error) {
      setMachineError(res.error.message);
      return;
    }
    await openMachineModal(machineModalTool);
  };

  const reloadSelectedToolUnits = async (refNo: number) => {
    const detail = await apiGet<{ tool: GaugeAndTool }>(`/api/tools/${refNo}`);
    if (detail.data?.tool) {
      setSelectedTool(detail.data.tool);
      setUnitRows(buildUnitHistoryRows(detail.data.tool));
    }
  };

  const handleCompletePreventive = async (unitRefNo?: number) => {
    if (!unitRefNo) {
      setBannerMsg({
        type: "error",
        text: "Unit reference missing — reload the tool and try again.",
      });
      return;
    }
    setBannerMsg(null);
    const res = await apiPost<{ nextPreDate?: string }>(`/api/tools/preventive-complete`, {
      unitRefNo,
    });
    if (res.error) {
      setBannerMsg({ type: "error", text: res.error.message });
      return;
    }
    setBannerMsg({
      type: "success",
      text: `Preventive MNT completed. Next due: ${res.data?.nextPreDate ?? "updated"}.`,
    });
    if (selectedTool?.refNo) await reloadSelectedToolUnits(selectedTool.refNo);
  };

  const handleAddUnit = async () => {
    if (!selectedTool?.refNo) {
      setBannerMsg({ type: "error", text: "Save the tool first, then add physical units." });
      return;
    }
    setUnitSaving(true);
    try {
      const res = await apiPost<{ unitHistory?: UnitHistoryRow[] }>(
        `/api/tools/${selectedTool.refNo}/serials`,
        {
          serialNo: unitForm.serialNo || undefined,
          make: unitForm.make || undefined,
          purchaseDt: unitForm.purchaseDt || undefined,
          nextPreDate: unitForm.nextPreDate || undefined,
          status: unitForm.status || undefined,
        }
      );
      if (res.error) throw new Error(res.error.message);
      setBannerMsg({ type: "success", text: "Physical unit added." });
      setUnitForm({
        serialNo: "",
        make: "",
        purchaseDt: "",
        nextPreDate: "",
        status: "AVAILABLE FOR USE",
      });
      await reloadSelectedToolUnits(selectedTool.refNo);
      loadTools();
    } catch (err) {
      setBannerMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to add unit",
      });
    } finally {
      setUnitSaving(false);
    }
  };

  const handleOpenAdd = useCallback(() => {
    setSelectedTool(null);
    resetForm();
    setFormEntryKey(`create-${Date.now()}`);
    setViewState("create");
  }, [resetForm]);

  const captureFormSnapshot = useCallback((): string => {
    return buildFormSnapshot({
      toolOrGaugeNo: toolOrGaugeNo.trim().toUpperCase(),
      name,
      description,
      size,
      shape,
      range,
      grouping,
      type,
      issueType,
      oldItemNo,
      drawingNo,
      revNoDt,
      location,
      locationName,
      area,
      rack,
      deptName,
      companyId,
      leastCount,
      serialNoGenReq,
      totQty,
      qtyIn: viewState === "create" ? totQty : qtyIn,
      uom,
      price,
      minOrderLevel,
      hsnCode,
      returnable,
      activeItem,
      criticalItem,
      poReq,
      stockReq,
      isAsset,
      saleableItem,
      nocReq,
      machineSoftware,
      ineligibleForItc,
      isCustGiven,
      detailedSpec,
      packingLength,
      packingWidth,
      packingHeight,
      packingDimensions,
      stiffness,
      selfLife,
      calibrationFrqMonths,
      caliPlannedWho,
      calibrationResponsibility,
      historyCardReq,
      preventiveMethod,
      preventiveFrqMonths,
      gSpecUpperMin,
      gSpecUpperMax,
      wLimitLowerMax,
      wLimitUpperMin,
      wLimitUpperMax,
      prodSpecLowerMax,
      prodSpecUpperMin,
      prodSpecUpperMax,
      specifications: specs
        .filter((s) => s.name.trim())
        .map((s) => ({
          parameter: s.name,
          specification: s.value || "",
          minRange: s.unit || "",
        })),
    });
  }, [
    toolOrGaugeNo,
    name,
    description,
    size,
    shape,
    range,
    grouping,
    type,
    issueType,
    oldItemNo,
    drawingNo,
    revNoDt,
    location,
    locationName,
    area,
    rack,
    deptName,
    companyId,
    leastCount,
    serialNoGenReq,
    totQty,
    qtyIn,
    viewState,
    uom,
    price,
    minOrderLevel,
    hsnCode,
    returnable,
    activeItem,
    criticalItem,
    poReq,
    stockReq,
    isAsset,
    saleableItem,
    nocReq,
    machineSoftware,
    ineligibleForItc,
    isCustGiven,
    detailedSpec,
    packingLength,
    packingWidth,
    packingHeight,
    packingDimensions,
    stiffness,
    selfLife,
    calibrationFrqMonths,
    caliPlannedWho,
    calibrationResponsibility,
    historyCardReq,
    preventiveMethod,
    preventiveFrqMonths,
    gSpecUpperMin,
    gSpecUpperMax,
    wLimitLowerMax,
    wLimitUpperMin,
    wLimitUpperMax,
    prodSpecLowerMax,
    prodSpecUpperMin,
    prodSpecUpperMax,
    specs,
  ]);

  const commitFormBaseline = useCallback(() => {
    formBaselineRef.current = captureFormSnapshot();
  }, [captureFormSnapshot]);

  const isFormDirty = useCallback(() => {
    return captureFormSnapshot() !== formBaselineRef.current;
  }, [captureFormSnapshot]);

  const executeLeave = useCallback((target: LeaveTarget) => {
    setLeavePrompt(null);
    setErrors({});
    if (target === "list") {
      setViewState("list");
      setSelectedTool(null);
    } else {
      setViewState("view");
    }
  }, []);

  const attemptLeave = useCallback(
    (target: LeaveTarget) => {
      if ((viewState === "create" || viewState === "edit") && isFormDirty()) {
        setLeavePrompt(target);
        return;
      }
      executeLeave(target);
    },
    [viewState, isFormDirty, executeLeave]
  );

  useEffect(() => {
    if (viewState !== "create" && viewState !== "edit") return;
    if (!formEntryKey) return;
    const t1 = window.setTimeout(() => commitFormBaseline(), 200);
    const t2 = window.setTimeout(() => commitFormBaseline(), 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [formEntryKey, viewState, commitFormBaseline]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((viewState === "create" || viewState === "edit") && isFormDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [viewState, isFormDirty]);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleOpenAdd();
    }
  }, [searchParams, handleOpenAdd]);

  const performSave = async (opts?: { leaveAfter?: LeaveTarget | null }): Promise<boolean> => {
    const fErrors: Record<string, string> = {};
    if (!toolOrGaugeNo.trim()) fErrors.toolOrGaugeNo = "Tool Number is required";
    if (!name.trim()) fErrors.name = "Tools Name is required";
    if (!grouping.trim()) fErrors.grouping = "Tools Group is required";
    if (totQty < 0) fErrors.totQty = "Quantity cannot be negative";
    if (viewState === "create" && stockReq === "Yes" && totQty < 1) {
      fErrors.totQty = "Set Tot Qty ≥ 1 so the tool can be issued (Qty In starts from Tot Qty)";
    }
    if (serialNoGenReq && totQty <= 0) {
      fErrors.totQty = "Serial generation requires Total Qty > 0";
    }
    if (historyCardReq === "Yes" && calibrationFrqMonths <= 0) {
      fErrors.calibrationFrqMonths = "Calibration Frequency (months) must be > 0 when History Card = Yes";
    }
    if (filteredTypes.length > 0 && !type.trim()) {
      fErrors.type = "Tools Type is required for this group";
    }
    if (Object.keys(fErrors).length > 0) {
      setErrors(fErrors);
      if (fErrors.calibrationFrqMonths) setActiveTab("calibration");
      else if (fErrors.totQty) setActiveTab("stock");
      else setActiveTab("general");
      return false;
    }

    const payload = {
      toolOrGaugeNo: toolOrGaugeNo.trim().toUpperCase(),
      name,
      description: description || undefined,
      size: size || undefined,
      shape: shape || undefined,
      range: range || undefined,
      grouping,
      type: type || undefined,
      issueType: issueType || undefined,
      oldItemNo: oldItemNo || undefined,
      drawingNo: drawingNo || undefined,
      revNoDt: revNoDt || undefined,
      location: location || locationName || undefined,
      locationName: locationName || undefined,
      area: area || undefined,
      rack: rack || undefined,
      deptName: deptName || undefined,
      companyId: companyId || undefined,
      leastCount: leastCount || undefined,
      serialNoGenReq,
      totQty,
      qtyIn: viewState === "create" ? totQty : qtyIn,
      // Do not write invent a lifecycle STATUS — ERP leaves this null.
      status: null,
      uom: uom || undefined,
      price,
      minOrderLevel,
      hsnCode: hsnCode || undefined,
      returnable,
      activeItem,
      criticalItem,
      poReq,
      stockReq,
      stockItem: "Y",
      isAsset,
      saleableItem,
      nocReq,
      machineSoftware,
      ineligibleForItc,
      isCustGiven,
      detailedSpec: detailedSpec || undefined,
      packingLength: packingLength || undefined,
      packingWidth: packingWidth || undefined,
      packingHeight: packingHeight || undefined,
      packingDimensions: packingDimensions || undefined,
      stiffness: stiffness || undefined,
      selfLife: selfLife || undefined,
      calibrationFrqMonths,
      caliPlannedWho: caliPlannedWho || undefined,
      calibrationResponsibility: calibrationResponsibility || undefined,
      historyCardReq,
      preventiveMethod: preventiveMethod || undefined,
      preventiveFrqMonths,
      gSpecUpperMin,
      gSpecUpperMax,
      wLimitLowerMax,
      wLimitUpperMin,
      wLimitUpperMax,
      prodSpecLowerMax,
      prodSpecUpperMin,
      prodSpecUpperMax,
      specifications: specs
        .filter((s) => s.name.trim())
        .map((s) => ({
          parameter: s.name,
          specification: s.value || undefined,
          minRange: s.unit || undefined,
        })),
    };

    setBannerMsg(null);
    const res = selectedTool
      ? await apiPut<{ tool: GaugeAndTool }>(`/api/tools/${selectedTool.refNo}`, payload)
      : await apiPost<{ tool: GaugeAndTool }>("/api/tools", payload);

    if (res.error) {
      const message =
        typeof res.error.message === "string"
          ? res.error.message
          : "Unable to save tool. Check required fields.";
      setBannerMsg({ type: "error", text: message });
      return false;
    }

    const saved = res.data?.tool;
    setSuccessBanner("Tool saved successfully.");
    showSuccess({
      title: "Record saved",
      message: selectedTool ? "Tool record updated successfully." : "Tool record created successfully.",
      detail: saved?.toolOrGaugeNo || undefined,
    });
    setTimeout(() => setSuccessBanner(""), 3000);
    if (saved?.refNo) {
      const detail = await apiGet<{ tool: GaugeAndTool }>(`/api/tools/${saved.refNo}`);
      const toolData = detail.data?.tool ?? saved;
      fillForm(toolData);
      setSelectedTool(toolData);
      if (opts?.leaveAfter) {
        executeLeave(opts.leaveAfter);
      } else {
        setFormEntryKey(`edit-${toolData.refNo}`);
        setViewState("edit");
        setBannerMsg({
          type: "success",
          text: "Tool saved. You can add physical units in the grid below.",
        });
      }
    } else if (opts?.leaveAfter) {
      executeLeave(opts.leaveAfter);
    } else {
      setViewState("list");
    }
    commitFormBaseline();
    loadTools();
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSave();
  };

  const handleLeaveSave = async () => {
    if (!leavePrompt) return;
    setLeaveSaving(true);
    const target = leavePrompt;
    const ok = await performSave({ leaveAfter: target });
    setLeaveSaving(false);
    if (!ok) setLeavePrompt(target);
  };

  const handleLeaveDiscard = () => {
    if (!leavePrompt) return;
    executeLeave(leavePrompt);
  };

  const handleDeleteTool = async (refNo: number) => {
    if (!confirm("Are you sure you want to delete this tool?")) return;
    const res = await apiDelete(`/api/tools/${refNo}`);
    if (res.error) {
      setBannerMsg({ type: "error", text: String(res.error.message) });
      return;
    }
    setBannerMsg({ type: "success", text: "Tool deleted." });
    loadTools();
  };

  const buildExportQuery = () => {
    const params = new URLSearchParams();
    if (selectedRefNos.length > 0) {
      params.set("ids", selectedRefNos.join(","));
    } else {
      if (query) params.set("search", query);
      if (groupFilter !== "All") params.set("grouping", groupFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
    }
    return params;
  };

  const downloadBlob = async (url: string, fallbackName: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match?.[1] ?? fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
    return res;
  };

  const runExport = async (format: "xlsx" | "pdf") => {
    setExportBusy(format);
    setExportMsg(null);
    try {
      const params = buildExportQuery();
      params.set("format", format);
      const res = await downloadBlob(
        `/api/tools/export?${params}`,
        `tools_master.${format === "xlsx" ? "xlsx" : "pdf"}`
      );
      const count = res.headers.get("X-Export-Count");
      const mode = res.headers.get("X-Export-Mode");
      setExportMsg({
        type: "success",
        text: count
          ? `Exported ${Number(count).toLocaleString()} ${mode === "selected" ? "selected" : "filtered"} tool(s).`
          : "Export ready.",
      });
    } catch (err) {
      setExportMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Export failed",
      });
    } finally {
      setExportBusy(null);
    }
  };

  const downloadTemplate = async (kind: "basic" | "full" | "price") => {
    setExportBusy("template");
    setExportMsg(null);
    try {
      await downloadBlob(
        `/api/tools/export?format=xlsx&template=${kind}`,
        `tools_master_${kind}_template.xlsx`
      );
      setExportMsg({
        type: "success",
        text: `${kind === "basic" ? "Basic Info" : kind === "full" ? "Full Details" : "Price Update"} template downloaded.`,
      });
    } catch (err) {
      setExportMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Template download failed",
      });
    } finally {
      setExportBusy(null);
    }
  };

  const startImport = (kind: "basic" | "full" | "price") => {
    setImportTemplate(kind);
    setShowImportChooser(false);
    importFileRef.current?.click();
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || !importTemplate) return;
    setImportBusy("preview");
    setImportPreview(null);
    setBannerMsg(null);
    try {
      const form = new FormData();
      form.set("action", "preview");
      form.set("template", importTemplate);
      form.set("file", file);
      const res = await fetch("/api/tools/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Import preview failed");
      }
      setImportPreview({
        template: data.template ?? importTemplate,
        createCount: data.createCount ?? 0,
        updateCount: data.updateCount ?? 0,
        rejectCount: data.rejectCount ?? 0,
        rejected: data.rejected ?? [],
        pendingRows: data.pendingRows ?? [],
      });
    } catch (err) {
      setBannerMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Import preview failed",
      });
    } finally {
      setImportBusy(null);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.pendingRows.length === 0) return;
    setImportBusy("confirm");
    try {
      const res = await apiPost<{ created: number; updated: number }>("/api/tools/import", {
        action: "confirm",
        template: importPreview.template,
        pendingRows: importPreview.pendingRows,
      });
      if (res.error) throw new Error(res.error.message);
      setBannerMsg({
        type: "success",
        text: `Import complete — created ${res.data?.created ?? 0}, updated ${res.data?.updated ?? 0}.`,
      });
      setImportPreview(null);
      setImportTemplate(null);
      loadTools();
    } catch (err) {
      setBannerMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Confirm import failed",
      });
    } finally {
      setImportBusy(null);
    }
  };

  // Rows already filtered+paged by the API — don't re-filter client-side
  // (that would hide rows incorrectly and break pagination).
  const filtered = tools;

  const filteredRefNos = filtered.map((t) => t.refNo);
  const allFilteredSelected =
    filteredRefNos.length > 0 && filteredRefNos.every((id) => selectedRefNos.includes(id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const exportCountLabel =
    selectedRefNos.length > 0
      ? `${selectedRefNos.length} selected`
      : `${total.toLocaleString()} matching`;

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedRefNos((prev) => prev.filter((id) => !filteredRefNos.includes(id)));
    } else {
      setSelectedRefNos((prev) => Array.from(new Set([...prev, ...filteredRefNos])));
    }
  };

  const toggleSelectOne = (refNo: number) => {
    setSelectedRefNos((prev) =>
      prev.includes(refNo) ? prev.filter((id) => id !== refNo) : [...prev, refNo]
    );
  };

  const selectedTypeMeta = toolsSubgroups.find((sg) => sg.name === type);
  const typeProfile = resolveTypeProfile(type, grouping, selectedTypeMeta?.assetCategory);

  // Independent legacy toggles — each unlocks its own field group
  const calibBlockEnabled = historyCardReq === "Yes";
  const prevBlockEnabled = isAsset === "Yes";

  const resetCalibrationBlock = () => {
    setCalibrationFrqMonths(0);
    setCaliPlannedWho("N/A");
    setCalibrationResponsibility("N/A");
    setGSpecUpperMin(0);
    setGSpecUpperMax(0);
    setWLimitLowerMax(0);
    setWLimitUpperMin(0);
    setWLimitUpperMax(0);
    setProdSpecLowerMax(0);
    setProdSpecUpperMin(0);
    setProdSpecUpperMax(0);
  };

  const resetPreventiveBlock = () => {
    setPreventiveMethod("N/A");
    setPreventiveFrqMonths(0);
  };

  const handleHistoryCardReqChange = (value: string) => {
    setHistoryCardReq(value);
    if (value !== "Yes") resetCalibrationBlock();
  };

  const handleIsAssetChange = (value: string) => {
    setIsAsset(value);
    if (value !== "Yes") resetPreventiveBlock();
  };

  const hasCalibrationData =
    serialNoGenReq ||
    historyCardReq === "Yes" ||
    calibrationFrqMonths > 0 ||
    (caliPlannedWho && caliPlannedWho !== "N/A") ||
    gSpecUpperMin > 0 ||
    gSpecUpperMax > 0 ||
    unitRows.length > 0;

  const hasPreventiveData =
    isAsset === "Yes" ||
    preventiveFrqMonths > 0 ||
    (preventiveMethod && preventiveMethod !== "N/A");

  // Create/edit always expose both tabs so the two toggles stay independently reachable.
  // View keeps type/data-based visibility.
  const isFormEdit = viewState === "create" || viewState === "edit";
  const showCalibrationTab =
    isFormEdit ||
    typeProfile === "gauge" ||
    (hasCalibrationData && typeProfile !== "consumable" && typeProfile !== "form");

  const showPreventiveTab =
    isFormEdit ||
    typeProfile === "preventive" ||
    (hasPreventiveData && typeProfile !== "consumable");

  // Specs always visible on calibration tab in create/edit; disabled when History Card ≠ Yes
  const showGaugeSpecs =
    isFormEdit || typeProfile === "gauge" || (hasCalibrationData && typeProfile !== "form");
  const showSpecsTab =
    typeProfile === "form" ||
    typeProfile === "generic" ||
    typeProfile === "gauge" ||
    typeProfile === "preventive" ||
    Boolean(detailedSpec.trim()) ||
    specs.length > 0;

  // Detail-view sections (type-conditional, like the edit tabs)
  const showDetailedSpecSection = typeProfile === "form" || Boolean(detailedSpec.trim());
  const hasTechDimData =
    Boolean(drawingNo || revNoDt || stiffness || packingDimensions) ||
    Boolean(packingLength || packingWidth || packingHeight) ||
    selfLife > 0;
  const showTechDimSection = typeProfile !== "consumable" || hasTechDimData;
  const showCaliMntSection = showCalibrationTab || showPreventiveTab;
  // Always show unit grid on view/edit (legacy bottom grid) — empty until units exist
  const showSerialUnitsSection = viewState === "view" || viewState === "edit";
  const showUnitHistoryTable = viewState === "edit";

  const sectionNo = (() => {
    let n = 1;
    return {
      core: n++,
      gauge: showGaugeSpecs ? n++ : 0,
      detailedSpec: showDetailedSpecSection ? n++ : 0,
      stock: n++,
      tech: showTechDimSection ? n++ : 0,
      cali: showCaliMntSection ? n++ : 0,
    };
  })();

  const tabItems: Array<{ id: TabId; label: string }> = [
    { id: "general", label: "General Info" },
    { id: "stock", label: "Stock & Flags" },
    ...(showCalibrationTab ? [{ id: "calibration" as const, label: "Calibration" }] : []),
    ...(showPreventiveTab ? [{ id: "preventive" as const, label: "Preventive MNT" }] : []),
    ...(showSpecsTab ? [{ id: "specs" as const, label: "Technical Details" }] : []),
  ];

  useEffect(() => {
    const visible = new Set<TabId>(["general", "stock"]);
    if (showCalibrationTab) visible.add("calibration");
    if (showPreventiveTab) visible.add("preventive");
    if (showSpecsTab) visible.add("specs");
    if (!visible.has(activeTab)) setActiveTab("general");
  }, [activeTab, showCalibrationTab, showPreventiveTab, showSpecsTab]);

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {successMessage && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-sm font-semibold shadow-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {bannerMsg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                bannerMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {bannerMsg.text}
              <button onClick={() => setBannerMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {viewState === "list" ? (
            <>
              <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Tools Manage</h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    Core tool records with type-relevant detail fields
                  </p>
                </div>
                <RoleGate permission="canEditMaster">
                  <Button id="tools-add-btn" onClick={handleOpenAdd} variant="primary" className="group">
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                    Add Tool Record
                  </Button>
                </RoleGate>
              </div>

              <ModuleKpiRow
                items={[
                  {
                    id: "total-tools",
                    label: "Total Registered",
                    value: total,
                    subtext:
                      total > pageSize
                        ? `Page ${page} of ${totalPages}`
                        : "Full registry count",
                    title:
                      total > pageSize
                        ? `Showing page ${page} of ${totalPages} (${filtered.length} rows)`
                        : "Registry database count",
                    icon: Plus,
                    iconBg: "bg-[var(--primary-light)]",
                    iconColor: "text-[var(--primary)]",
                    badge: { label: "Registry", type: "info" },
                  },
                  {
                    id: "available-tools",
                    label: "In Store (Available)",
                    value: tools.filter((t) => t.computedStatus === "Available").length,
                    subtext: "Ready for issue on this page",
                    title: "On this page — units ready for issue",
                    icon: CheckCircle2,
                    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                    iconColor: "text-emerald-600 dark:text-emerald-400",
                    badge: { label: "In Stock", type: "success" },
                  },
                  {
                    id: "in-use-tools",
                    label: "In Use",
                    value: tools.filter((t) => t.computedStatus === "In Use").length,
                    subtext: "Issued on this page",
                    title: "On this page — inhouse, vendor, or new purchase",
                    icon: Search,
                    iconBg: "bg-blue-50 dark:bg-blue-950/30",
                    iconColor: "text-blue-600 dark:text-blue-400",
                    badge: { label: "In Use", type: "info" },
                  },
                  {
                    id: "service-tools",
                    label: "Calib / Attention",
                    value: tools.filter(
                      (t) => t.computedStatus === "In Calibration" || t.computedStatus === "Needs Attention"
                    ).length,
                    subtext: "Service needed on this page",
                    title: "On this page — calibration or rejected/worn out",
                    icon: Wrench,
                    iconBg: "bg-amber-50 dark:bg-amber-950/30",
                    iconColor: "text-amber-600 dark:text-amber-400",
                    badge: { label: "Service", type: "warning" },
                  },
                ]}
              />

              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tools-search-input"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search tool name, number, or group…"
                      className="w-full text-sm border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] transition-all bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      id="tools-group-filter"
                      value={groupFilter}
                      onChange={(e) => {
                        setGroupFilter(e.target.value);
                        setPage(1);
                      }}
                      className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
                    >
                      <option value="All">All Groups</option>
                      {toolsGroups.map((g) => (
                        <option key={g.rowId ?? g.id ?? g.code} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <select
                      id="tools-status-filter"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                      className="text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] font-medium text-[var(--text-primary)]"
                    >
                      <option value="All">All Statuses</option>
                      {ROLLUP_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 animate-fade-in">
                <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Import / Export
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {selectedRefNos.length > 0
                        ? `Export will use ${selectedRefNos.length} selected row(s).`
                        : `Export will use ${total.toLocaleString()} matching tool(s) (all pages). Import requires Tools Admin.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
                    />
                    <RoleGate permission="canEditMaster">
                      <div className="relative">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!!importBusy || !!exportBusy}
                          onClick={() => setShowImportChooser((v) => !v)}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {importBusy === "preview" ? "Validating…" : "Import"}
                        </Button>
                        {showImportChooser && (
                          <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-lg p-2 space-y-1">
                            {(
                              [
                                { kind: "basic" as const, title: "Basic Info", desc: "Upsert core tool fields" },
                                { kind: "full" as const, title: "Full Details", desc: "Includes serial + details" },
                                { kind: "price" as const, title: "Price Update Only", desc: "Update price — never creates" },
                              ] as const
                            ).map((opt) => (
                              <div
                                key={opt.kind}
                                className="rounded-lg border border-[var(--border-main)] p-2.5 space-y-2"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">{opt.title}</p>
                                  <p className="text-[11px] text-[var(--text-muted)]">{opt.desc}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="flex-1"
                                    disabled={!!exportBusy}
                                    onClick={() => downloadTemplate(opt.kind)}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Template
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1"
                                    disabled={!!importBusy}
                                    onClick={() => startImport(opt.kind)}
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    Upload
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="w-full text-xs text-[var(--text-muted)] py-1.5 hover:text-[var(--text-primary)]"
                              onClick={() => setShowImportChooser(false)}
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    </RoleGate>
                    <div className="inline-flex rounded-xl border border-[var(--border-main)] overflow-hidden bg-[var(--bg-card)] shadow-xs">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-none border-r border-[var(--border-main)]"
                        disabled={!!exportBusy}
                        onClick={() => runExport("xlsx")}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        {exportBusy === "xlsx" ? "Preparing…" : `Export Excel (${exportCountLabel})`}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-none"
                        disabled={!!exportBusy}
                        onClick={() => runExport("pdf")}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {exportBusy === "pdf" ? "Preparing…" : `Export PDF (${exportCountLabel})`}
                      </Button>
                    </div>
                  </div>
                </div>

                {exportMsg && (
                  <div
                    className={`mb-3 px-4 py-3 rounded-xl text-sm font-medium ${
                      exportMsg.type === "success"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-main)]"
                        : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-main)]"
                    }`}
                  >
                    {exportMsg.text}
                  </div>
                )}

                {importPreview && (
                  <div className="mb-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Import preview —{" "}
                          {importPreview.template === "basic"
                            ? "Basic Info"
                            : importPreview.template === "full"
                              ? "Full Details"
                              : "Price Update Only"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Nothing has been written yet. Review and confirm to apply.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        onClick={() => {
                          setImportPreview(null);
                          setImportTemplate(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Create {importPreview.createCount}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        Update {importPreview.updateCount}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                        Rejected {importPreview.rejectCount}
                      </span>
                    </div>
                    {importPreview.rejected.length > 0 && (
                      <div className="max-h-40 overflow-auto rounded-lg border border-red-200 bg-white/60 p-3 text-xs space-y-1">
                        {importPreview.rejected.map((r) => (
                          <p key={`${r.row}-${r.reason}`} className="text-red-700">
                            Row {r.row}: {r.reason}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={importBusy === "confirm" || importPreview.pendingRows.length === 0}
                        onClick={confirmImport}
                      >
                        {importBusy === "confirm" ? "Importing…" : "Confirm Import"}
                      </Button>
                      <p className="text-xs text-[var(--text-muted)]">
                        {importPreview.template === "price"
                          ? "Update-only: never creates tools."
                          : importPreview.template === "full"
                            ? "Writes GAUGEANDTOOLS + serial/details where provided."
                            : "Writes GAUGEANDTOOLS only."}
                      </p>
                    </div>
                  </div>
                )}

                {loading ? (
                  <TableSkeleton rows={6} />
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                          <th className="py-2.5 px-3 w-10">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={toggleSelectAllFiltered}
                              className="w-4 h-4 rounded border-[var(--border-main)]"
                              aria-label="Select all filtered tools"
                            />
                          </th>
                          {[
                            "Tool Or Gauge No",
                            "Description",
                            "Total Qty",
                            "Avail.For.Iss.",
                            "Location",
                            "Ret?",
                            "Sl.No?",
                            "Issue Type",
                            "Critical?",
                            "PS.Min",
                            "PS.Max",
                            "Ref. No",
                            "Least Count",
                            "Buffer Qty",
                            "Status",
                            "Machine",
                            "Actions",
                          ].map((col) => (
                            <th
                              key={col}
                              className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {filtered.map((t) => {
                          const badge = t.computedStatus ?? "No Units";
                          const sc = statusConfig[badge] ?? statusConfig["No Units"];
                          const isChecked = selectedRefNos.includes(t.refNo);
                          const hasMachine = (t.machines?.length ?? 0) > 0;
                          return (
                            <tr
                              key={t.refNo}
                              onClick={() => handleRowClick(t)}
                              className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
                            >
                              <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelectOne(t.refNo)}
                                  className="w-4 h-4 rounded border-[var(--border-main)]"
                                  aria-label={`Select ${t.toolOrGaugeNo}`}
                                />
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] font-semibold whitespace-nowrap group-hover:text-[var(--primary)] transition-colors">
                                {t.toolOrGaugeNo}
                              </td>
                              <td className="py-3.5 px-3 max-w-[240px]">
                                <p className="text-[var(--text-primary)] line-clamp-2">
                                  {t.description || t.name || "—"}
                                </p>
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {num(t.totQty)}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {num(t.qtyIn)}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap max-w-[140px] truncate">
                                {t.location || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">
                                {yesNoValue(t.returnable, "—")}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">
                                {yesNoValue(t.serialNoGenReq, "—")}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                {t.issueType || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">
                                {yesNoValue(t.criticalItem, "—")}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {t.prodSpecLowerMax != null ? num(t.prodSpecLowerMax) : "—"}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {t.prodSpecUpperMax != null ? num(t.prodSpecUpperMax) : "—"}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {t.refNo}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                {t.leastCount || "—"}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {t.minOrderLevel != null ? num(t.minOrderLevel) : "—"}
                              </td>
                              <td className="py-3.5 px-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${sc.bg} ${sc.text}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {badge}
                                </span>
                              </td>
                              <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => void openMachineModal(t)}
                                  className={`inline-flex p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    hasMachine
                                      ? "text-[var(--primary)] hover:bg-[var(--primary-light)]"
                                      : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] opacity-60 hover:opacity-100"
                                  }`}
                                  title={
                                    hasMachine
                                      ? `Machines: ${t.machines!.join(", ")} — click to manage`
                                      : "No machine mapped — click to assign"
                                  }
                                >
                                  <Cog className="w-4 h-4" />
                                </button>
                              </td>
                              <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRowClick(t)}
                                    className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                                    title="View Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <RoleGate permission="canEditMaster">
                                    <button
                                      onClick={() => {
                                        fillForm(t);
                                        setSelectedTool(t);
                                        setFormEntryKey(`edit-${t.refNo}`);
                                        setViewState("edit");
                                      }}
                                      className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                      title="Edit Tool"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTool(t.refNo)}
                                      className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors cursor-pointer"
                                      title="Delete Tool"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </RoleGate>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={18} className="py-8 text-center text-sm text-[var(--text-muted)]">
                              No tool records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loading && total > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--border-main)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-muted)]">
                      Showing{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                      </span>{" "}
                      of <span className="font-semibold text-[var(--text-primary)]">{total.toLocaleString()}</span>{" "}
                      tools
                      {totalPages > 1 ? ` · Page ${page} of ${totalPages.toLocaleString()}` : ""}
                    </span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="tools-prev-page"
                          disabled={page <= 1 || loading}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          ← Previous
                        </button>
                        <button
                          type="button"
                          id="tools-next-page"
                          disabled={page >= totalPages || loading}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : viewState === "view" ? (
            <div className="animate-fade-in space-y-6">
              {/* Header Navigation & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewState("list")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Registry List
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-0.5 rounded">
                        {toolOrGaugeNo}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-main)]">
                        {grouping} {type ? `/ ${type}` : ""}
                      </span>
                    </div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] mt-1">
                      {!name || name.trim().toUpperCase() === "N/A" ? description || toolOrGaugeNo : name}
                    </h1>
                  </div>
                </div>
                <RoleGate permission="canEditMaster">
                  <Button
                    onClick={() => {
                      setFormEntryKey(`edit-${selectedTool?.refNo ?? 0}`);
                      setViewState("edit");
                    }}
                    variant="primary"
                    size="sm"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Tool Master
                  </Button>
                </RoleGate>
              </div>

              {/* Top Overview KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)]">
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)] tracking-wider">Total Quantity</p>
                  <p className="font-mono text-xl font-bold text-[var(--text-primary)] mt-1">{totQty}</p>
                </div>
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)]">
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)] tracking-wider">In Stock (Available)</p>
                  <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{qtyIn}</p>
                </div>
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)]">
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)] tracking-wider">Issued Out</p>
                  <p className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{qtyOut}</p>
                </div>
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)]">
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)] tracking-wider">Unit Price</p>
                  <p className="font-mono text-xl font-bold text-[var(--text-primary)] mt-1">{price ? `₹${price}` : "—"}</p>
                </div>
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)]">
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)] tracking-wider">Buffer / ROL Qty</p>
                  <p className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{minOrderLevel || "—"}</p>
                </div>
              </div>

              {/* Main Attributes Panel — Mirroring ERP screenshot layout */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-6">
                {/* 1. Classification & Core Info */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                    {sectionNo.core}. Classification & Core Parameters
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">QMS Tools Group</p><p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">{grouping || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Item Type</p><p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">{type || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Item Name</p><p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">{name || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Item No / Tool Code</p><p className="font-mono font-bold text-sm text-[var(--text-primary)] mt-0.5">{toolOrGaugeNo}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Issue Type</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{issueType || "For Regular"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Asset Category</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{selectedTypeMeta?.assetCategory || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Old Item No</p><p className="font-mono text-[var(--text-primary)] mt-0.5">{oldItemNo || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Description</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{description || "—"}</p></div>
                  </div>
                </div>

                {/* Gauge Specs & Tolerance Limits — gauge/instrument types only */}
                {showGaugeSpecs && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                      {sectionNo.gauge}. Gauge Specification & Wear Limits
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-main)]">
                      <div><p className="text-[var(--text-muted)] font-semibold uppercase">Gauge Spec Lower (Min)</p><p className="font-mono font-bold text-sm mt-0.5">{gSpecUpperMin ?? "0.000"}</p></div>
                      <div><p className="text-[var(--text-muted)] font-semibold uppercase">Gauge Spec Upper (Max)</p><p className="font-mono font-bold text-sm mt-0.5">{gSpecUpperMax ?? "0.000"}</p></div>
                      <div><p className="text-[var(--text-muted)] font-semibold uppercase">Wear Limit Lower (Min)</p><p className="font-mono font-bold text-sm mt-0.5">{wLimitLowerMax ?? "0.000"}</p></div>
                      <div><p className="text-[var(--text-muted)] font-semibold uppercase">Wear Limit Upper (Max)</p><p className="font-mono font-bold text-sm mt-0.5">{wLimitUpperMin ?? "0.000"}</p></div>
                      <div><p className="text-[var(--text-muted)] font-semibold uppercase">Product Spec Lower (Min)</p><p className="font-mono font-bold text-sm mt-0.5">{prodSpecLowerMax ?? "0.000"}</p></div>
                      <div><p className="text-[var(--text-muted)] font-semibold uppercase">Product Spec Upper (Max)</p><p className="font-mono font-bold text-sm mt-0.5">{prodSpecUpperMax ?? "0.000"}</p></div>
                    </div>
                  </div>
                )}

                {/* Detailed Specification — primary for Form Tools */}
                {showDetailedSpecSection && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                      {sectionNo.detailedSpec}. Detailed Specification
                    </h2>
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-main)]">
                      {detailedSpec.trim() || "—"}
                    </p>
                  </div>
                )}

                {/* Stock, Storage & Commercial Flags */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                    {sectionNo.stock}. Stock & Commercial Flags
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stock / Purchase UOM</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{uom || "Nos"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stored Location</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{location || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Price</p><p className="font-mono font-bold text-[var(--text-primary)] mt-0.5">{price ? `₹${price}` : "0.00"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Issue By Customer</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{isCustGiven || "No"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">PO Required?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{poReq || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stock Required?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{stockReq || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Critical Item?</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{criticalItem || "No"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Returnable?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{returnable || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Is Asset?</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{isAsset || "No"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Active Item?</p><p className="font-semibold text-emerald-600 mt-0.5">{activeItem || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">HSN Code</p><p className="font-mono font-semibold text-[var(--text-primary)] mt-0.5">{hsnCode || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">NOC Required?</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{nocReq || "Yes"}</p></div>
                  </div>
                </div>

                {/* Physical & Location Details — hidden for consumables with no data */}
                {showTechDimSection && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                    {sectionNo.tech}. Location & Technical Dimensions
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Area / Department</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{area || deptName || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Rack No</p><p className="font-mono font-medium text-[var(--text-primary)] mt-0.5">{rack || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Drawing No</p><p className="font-mono font-semibold text-[var(--text-primary)] mt-0.5">{drawingNo || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Rev No & Date</p><p className="font-mono text-[var(--text-primary)] mt-0.5">{revNoDt || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Shelf Life (Months)</p><p className="font-mono text-[var(--text-primary)] mt-0.5">{selfLife || 0}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Dimensions (L x W x H)</p><p className="font-mono text-[var(--text-primary)] mt-0.5">{packingDimensions || `${packingLength || 0} x ${packingWidth || 0} x ${packingHeight || 0} mm`}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stiffness</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{stiffness || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Machine Software</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{machineSoftware || "Yes"}</p></div>
                  </div>
                </div>
                )}

                {/* Calibration & Maintenance Parameters — relevant types only */}
                {showCaliMntSection && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                    {sectionNo.cali}. Calibration & Preventive Maintenance Parameters
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-main)]">
                    {showCalibrationTab && (
                      <>
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">Is Serial No Generation Required?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{serialNoGenReq ? "Yes" : "No"}</p></div>
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">History Card?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{historyCardReq || "No"}</p></div>
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">Calibration Frequency</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{calibrationFrqMonths ? `${calibrationFrqMonths} Months` : "N/A"}</p></div>
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">Calibration Planned To</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{caliPlannedWho || "N/A"}</p></div>
                      </>
                    )}
                    {showPreventiveTab && (
                      <>
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">Preventive MNT Method</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{preventiveMethod || "N/A"}</p></div>
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">Preventive MNT Frequency</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{preventiveFrqMonths ? `${preventiveFrqMonths} Months` : "0"}</p></div>
                      </>
                    )}
                  </div>
                </div>
                )}
              </div>

              {/* Serial Numbers & Calibration History — always on view/edit */}
              {showSerialUnitsSection && (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      {calibBlockEnabled ? "Individual Serial Units & Calibration History" : "Individual Serial Units"}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Physical units from GAUGE_SERIAL_NO — empty until units are added for this tool
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] px-3 py-1 rounded-full">
                    {unitRows.length} Serialized Units
                  </span>
                </div>

                {!calibBlockEnabled && (
                  <div className="mb-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--text-muted)]">
                    Calibration tracking is not enabled for this item (History Card = No). Unit records are shown for asset tracking only.
                  </div>
                )}

                {selectedTool?.refNo && calibBlockEnabled && (
                  <div className="mb-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Add physical unit
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div>
                        <FieldLabel>MFG / Serial No</FieldLabel>
                        <TextInput
                          value={unitForm.serialNo}
                          onChange={(e) => setUnitForm((f) => ({ ...f, serialNo: e.target.value }))}
                          placeholder="Auto if blank"
                          disabled={viewState === "view"}
                        />
                      </div>
                      <div>
                        <FieldLabel>Make</FieldLabel>
                        <TextInput
                          value={unitForm.make}
                          onChange={(e) => setUnitForm((f) => ({ ...f, make: e.target.value }))}
                          disabled={viewState === "view"}
                        />
                      </div>
                      <div>
                        <FieldLabel>Purchase Dt</FieldLabel>
                        <TextInput
                          type="date"
                          value={unitForm.purchaseDt}
                          onChange={(e) => setUnitForm((f) => ({ ...f, purchaseDt: e.target.value }))}
                          disabled={viewState === "view"}
                        />
                      </div>
                      <div>
                        <FieldLabel>Nxt PreMNT Dt</FieldLabel>
                        <TextInput
                          type="date"
                          value={unitForm.nextPreDate}
                          onChange={(e) => setUnitForm((f) => ({ ...f, nextPreDate: e.target.value }))}
                          disabled={viewState === "view"}
                        />
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <SelectInput
                          value={unitForm.status}
                          onChange={(e) => setUnitForm((f) => ({ ...f, status: e.target.value }))}
                          disabled={viewState === "view"}
                        >
                          <option>AVAILABLE FOR USE</option>
                          <option>Issued</option>
                          <option>ISSUE FOR CALIBRATION</option>
                          <option>Under Repair</option>
                          <option>Scrapped</option>
                        </SelectInput>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={unitSaving}
                      onClick={() => {
                        if (viewState === "view") {
                          setFormEntryKey(`edit-${selectedTool?.refNo ?? 0}`);
                          setViewState("edit");
                          return;
                        }
                        handleAddUnit();
                      }}
                    >
                      {viewState === "view"
                        ? "Edit to add units"
                        : unitSaving
                          ? "Saving…"
                          : "Add Unit"}
                    </Button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase tracking-wider">
                        {["S.No", "Status", "Purchase Dt", "Make", "MFG Serial No", ...(calibBlockEnabled ? ["Lst Cali Dt", "Nxt Cali Dt"] : []), "Lst PreMNT Dt", "Nxt PreMNT Dt", "Issue To / DC", "PM"].map((col) => (
                          <th key={col} className="py-2.5 px-3 text-left font-semibold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {unitRows.map((row, idx) => (
                        <tr key={row.key || idx} className="hover:bg-[var(--bg-hover)] transition-colors font-mono">
                          <td className="py-3 px-3 font-bold text-[var(--text-primary)]">{idx + 1}</td>
                          <td className="py-3 px-3 font-sans font-semibold">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--primary-light)] text-[var(--primary)]">
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[var(--text-secondary)]">{row.purchaseDt}</td>
                          <td className="py-3 px-3 font-sans text-[var(--text-secondary)]">{row.make}</td>
                          <td className="py-3 px-3 font-bold text-[var(--text-primary)]">{row.serialNo}</td>
                          {calibBlockEnabled && (
                            <>
                              <td className="py-3 px-3 text-[var(--text-secondary)]">{row.lastCaliDt}</td>
                              <td className="py-3 px-3 font-semibold text-amber-600 dark:text-amber-400">{row.nextCaliDt}</td>
                            </>
                          )}
                          <td className="py-3 px-3 text-[var(--text-secondary)]">{row.lastPreMntDt ?? "—"}</td>
                          <td className="py-3 px-3 text-[var(--text-secondary)]">{row.nextPreMntDt ?? "—"}</td>
                          <td className="py-3 px-3 font-sans text-[var(--text-secondary)]">
                            {row.dcNo && row.dcNo !== "—"
                              ? `${row.issueTo ?? "—"} · ${row.dcNo}${row.dcDate && row.dcDate !== "—" ? ` (${row.dcDate})` : ""}`
                              : row.issueTo && row.issueTo !== "—"
                                ? row.issueTo
                                : "In store"}
                          </td>
                          <td className="py-3 px-3 font-sans">
                            {prevBlockEnabled && row.refNo ? (
                              <button
                                type="button"
                                onClick={() => void handleCompletePreventive(row.refNo)}
                                className="text-[11px] font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
                                title="Mark preventive MNT done and advance next due"
                              >
                                Complete PM
                              </button>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {unitRows.length === 0 && (
                        <tr>
                          <td colSpan={calibBlockEnabled ? 11 : 9} className="py-8 text-center text-sm text-[var(--text-muted)] font-sans">
                            {calibBlockEnabled
                              ? "No records found. Add a physical unit after the tool is saved."
                              : "No records found."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in max-w-5xl">
              <button
                onClick={() => attemptLeave("list")}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to registry list
              </button>

              <div className="mb-5">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  {viewState === "create"
                    ? "New Tool"
                    : !name || name.trim().toUpperCase() === "N/A"
                      ? description || toolOrGaugeNo
                      : name}
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {viewState === "create" ? "Register a new tools record" : `Editing ${toolOrGaugeNo}`}
                </p>
              </div>

              <div className="flex items-center border-b border-[var(--border-main)] mb-6 overflow-x-auto gap-2">
                {tabItems.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setActiveTab(tb.id)}
                    className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-[2px] whitespace-nowrap ${
                      activeTab === tb.id
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {activeTab === "general" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel>Tool Number *</FieldLabel>
                        <div className="flex gap-2">
                          <TextInput
                            id="form-tool-no"
                            value={toolOrGaugeNo}
                            onChange={(e) => {
                              setToolNoLocked(true);
                              setToolOrGaugeNo(e.target.value.toUpperCase());
                            }}
                            disabled={viewState === "edit"}
                            placeholder="e.g. OTH_J00326"
                            className="font-mono uppercase font-semibold"
                          />
                          {viewState === "create" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setToolNoLocked(false);
                                void suggestToolNumber();
                              }}
                            >
                              Next #
                            </Button>
                          )}
                        </div>
                        {errors.toolOrGaugeNo && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.toolOrGaugeNo}</p>}
                      </div>
                      <div>
                        <FieldLabel>Tools Group *</FieldLabel>
                        <SelectInput
                          id="form-grouping"
                          value={grouping}
                          onChange={(e) => {
                            setGrouping(e.target.value);
                            setType("");
                            setName("");
                          }}
                        >
                          <option value="">Select group</option>
                          {toolsGroups.map((g) => (
                            <option key={g.rowId ?? g.id ?? g.code} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Tools Type{filteredTypes.length > 0 ? " *" : ""}</FieldLabel>
                        {filteredTypes.length > 0 ? (
                          <SelectInput
                            id="form-type"
                            value={type}
                            onChange={(e) => {
                              setType(e.target.value);
                              setName("");
                            }}
                          >
                            <option value="">Select type</option>
                            {filteredTypes.map((sg) => (
                              <option key={sg.rowId ?? sg.id ?? sg.code} value={sg.name}>
                                {sg.name}
                              </option>
                            ))}
                            {type && !filteredTypes.some((sg) => sg.name === type) && (
                              <option value={type}>{type}</option>
                            )}
                          </SelectInput>
                        ) : (
                          <>
                            <TextInput
                              id="form-type"
                              value={type}
                              onChange={(e) => {
                                setType(e.target.value);
                                setName("");
                              }}
                              placeholder="No master types for this group — enter manually"
                            />
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">
                              This group has zero Tools Type children in QMS_OTHER_TOOLS_TYPE.
                            </p>
                          </>
                        )}
                        {errors.type && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.type}</p>}
                      </div>
                      <div>
                        <FieldLabel>Tools Name *</FieldLabel>
                        <SelectInput id="form-name" value={name} onChange={(e) => setName(e.target.value)}>
                          <option value="">Select name</option>
                          <option value="N/A">N/A</option>
                          {filteredNames.map((n) => (
                            <option key={n.id} value={n.name}>
                              {n.name}
                            </option>
                          ))}
                          {name && name !== "N/A" && !filteredNames.some((n) => n.name === name) && (
                            <option value={name}>{name}</option>
                          )}
                        </SelectInput>
                        {filteredNames.length === 0 && grouping && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">
                            No names for this group/type — add them in Masters → Tools Name for Type.
                          </p>
                        )}
                        {errors.name && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.name}</p>}
                      </div>
                      <div>
                        <FieldLabel>Issue Type</FieldLabel>
                        <SelectInput value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                          {ERP_ISSUE_TYPES.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Company / Unit</FieldLabel>
                        <SelectInput value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                          {ERP_COMPANY_UNITS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Old Item No</FieldLabel>
                        <TextInput value={oldItemNo} onChange={(e) => setOldItemNo(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Drawing No</FieldLabel>
                        <TextInput value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Rev No and Date</FieldLabel>
                        <TextInput value={revNoDt} onChange={(e) => setRevNoDt(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Description</FieldLabel>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel>Size</FieldLabel>
                        <TextInput value={size} onChange={(e) => setSize(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Range</FieldLabel>
                        <TextInput value={range} onChange={(e) => setRange(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Shape</FieldLabel>
                        <TextInput value={shape} onChange={(e) => setShape(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Least Count</FieldLabel>
                        <TextInput value={leastCount} onChange={(e) => setLeastCount(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Location Name</FieldLabel>
                        <SelectInput
                          value={locationName}
                          onChange={(e) => {
                            const next = e.target.value;
                            setLocationName(next);
                            setLocation(next);
                            const match = locations.find((l) => l.locationName === next);
                            if (match?.area) setArea(match.area);
                            if (match?.rack) setRack(match.rack);
                          }}
                        >
                          <option value="">Select location</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.locationName ?? ""}>
                              {l.locationName}
                            </option>
                          ))}
                          {locationName && !locations.some((l) => l.locationName === locationName) && (
                            <option value={locationName}>{locationName}</option>
                          )}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Storage Location</FieldLabel>
                        <TextInput
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Defaults from Location Name"
                        />
                      </div>
                      <div>
                        <FieldLabel>Area</FieldLabel>
                        <TextInput
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          placeholder="No AREA master values in ERP yet"
                        />
                      </div>
                      <div>
                        <FieldLabel>Rack</FieldLabel>
                        <TextInput
                          value={rack}
                          onChange={(e) => setRack(e.target.value)}
                          placeholder="Free text — no rack master options"
                        />
                      </div>
                      <div>
                        <FieldLabel>Department</FieldLabel>
                        <SelectInput value={deptName} onChange={(e) => setDeptName(e.target.value)}>
                          <option value="">Select department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.name ?? ""}>
                              {d.name}
                            </option>
                          ))}
                          {deptName && !departments.some((d) => d.name === deptName) && (
                            <option value={deptName}>{deptName}</option>
                          )}
                        </SelectInput>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "stock" && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel>Total Qty</FieldLabel>
                        <TextInput
                          type="number"
                          min={0}
                          value={totQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTotQty(val);
                            if (viewState === "create") setQtyIn(val);
                          }}
                          className="font-mono font-semibold"
                        />
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          ERP allows 0 for items not yet received into stock.
                        </p>
                        {errors.totQty && <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">{errors.totQty}</p>}
                      </div>
                      <div>
                        <FieldLabel>UOM</FieldLabel>
                        <SelectInput value={uom} onChange={(e) => setUom(e.target.value)}>
                          {uomOptions.length === 0 && <option value="Nos">Nos</option>}
                          {uomOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          {uom && !uomOptions.includes(uom) && (
                            <option value={uom}>{uom}</option>
                          )}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Lifecycle Status</FieldLabel>
                        <p className="text-sm text-[var(--text-muted)] py-2">
                          Driven by physical units (GAUGE_SERIAL_NO) after create — not a create-time field.
                        </p>
                      </div>
                      <div>
                        <FieldLabel>Price</FieldLabel>
                        <TextInput type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                      </div>
                      <div>
                        <FieldLabel>ROL / Buffer Qty</FieldLabel>
                        <TextInput type="number" min={0} step="0.01" value={minOrderLevel} onChange={(e) => setMinOrderLevel(Number(e.target.value))} />
                      </div>
                      <div>
                        <FieldLabel>HSN Code</FieldLabel>
                        <TextInput value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-main)]">
                      <div>
                        <FieldLabel>Qty In Store</FieldLabel>
                        <p className="text-lg font-bold font-mono">{qtyIn}</p>
                      </div>
                      <div>
                        <FieldLabel>Qty Issued Out</FieldLabel>
                        <p className="text-lg font-bold font-mono">{qtyOut}</p>
                      </div>
                      <div>
                        <FieldLabel>New Stock</FieldLabel>
                        <p className="text-lg font-bold font-mono">{qtyNew}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        ["Returnable", returnable, setReturnable],
                        ["Active Item?", activeItem, setActiveItem],
                        ["Critical Item?", criticalItem, setCriticalItem],
                        ["PO Required?", poReq, setPoReq],
                        ["Stock Required?", stockReq, setStockReq],
                        ["Saleable Item", saleableItem, setSaleableItem],
                        ["NOC Required?", nocReq, setNocReq],
                        ["Machine Software", machineSoftware, setMachineSoftware],
                        ["Ineligible for ITC?", ineligibleForItc, setIneligibleForItc],
                        ["Issue by Customer", isCustGiven, setIsCustGiven],
                      ].map(([label, value, setter]) => (
                        <div key={label as string}>
                          <FieldLabel>{label as string}</FieldLabel>
                          <SelectInput value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}>
                            {YES_NO.map((opt) => (
                              <option key={opt}>{opt}</option>
                            ))}
                          </SelectInput>
                        </div>
                      ))}
                      <div>
                        <FieldLabel>Is Asset</FieldLabel>
                        <SelectInput value={isAsset} onChange={(e) => handleIsAssetChange(e.target.value)}>
                          {YES_NO.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          Yes unlocks Preventive MNT fields
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[var(--border-main)] pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Generate Unique Serials</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">Creates rows in GAUGE_SERIAL_NO</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={serialNoGenReq}
                          onChange={(e) => setSerialNoGenReq(e.target.checked)}
                          className="w-5 h-5 text-[var(--primary)] border-[var(--border-main)] rounded"
                        />
                      </div>
                      {serialNoGenReq && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!toolOrGaugeNo.trim()) return;
                            setSerialPreview(
                              Array.from({ length: totQty }, (_, i) => `${toolOrGaugeNo}-${String(i + 1).padStart(3, "0")}`)
                            );
                            setShowSerialPreview(true);
                          }}
                          className="text-xs font-bold text-[var(--primary)] hover:underline"
                        >
                          Preview Serial Numbers →
                        </button>
                      )}
                      {showSerialPreview && (
                        <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl max-h-36 overflow-y-auto font-mono text-xs space-y-1">
                          {serialPreview.map((s) => (
                            <p key={s}>{s}</p>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4" />
                        Qty In / Out / New update automatically from Issue, Receive, and GRN transactions.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "calibration" && showCalibrationTab && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel>History Card?</FieldLabel>
                        <SelectInput value={historyCardReq} onChange={(e) => handleHistoryCardReqChange(e.target.value)}>
                          {YES_NO.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          Yes unlocks Calibration fields
                        </p>
                      </div>
                      <div>
                        <FieldLabel>Calibration Planned To</FieldLabel>
                        <SelectInput
                          value={caliPlannedWho}
                          disabled={!calibBlockEnabled}
                          onChange={(e) => setCaliPlannedWho(e.target.value)}
                        >
                          {CALI_PLANNED_OPTIONS.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Calibration Responsibility</FieldLabel>
                        <SelectInput
                          value={calibrationResponsibility}
                          disabled={!calibBlockEnabled}
                          onChange={(e) => setCalibrationResponsibility(e.target.value)}
                        >
                          {CALI_RESP_OPTIONS.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Calibration Frequency (Months)</FieldLabel>
                        <TextInput
                          type="number"
                          min={0}
                          value={calibrationFrqMonths}
                          disabled={!calibBlockEnabled}
                          onChange={(e) => setCalibrationFrqMonths(Number(e.target.value))}
                        />
                        {errors.calibrationFrqMonths && (
                          <p className="text-[var(--color-danger-text)] text-xs mt-1 font-semibold">
                            {errors.calibrationFrqMonths}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-[var(--border-main)] pt-4">
                      <p className="text-sm font-semibold mb-3">
                        Gauge / Wear / Product Specs
                        {!calibBlockEnabled && (
                          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                            (set History Card to Yes to edit)
                          </span>
                        )}
                      </p>
                      {showGaugeSpecs ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <FieldLabel>Gauge Spec Upper Min</FieldLabel>
                          <TextInput type="number" step="0.001" value={gSpecUpperMin} disabled={!calibBlockEnabled} onChange={(e) => setGSpecUpperMin(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Gauge Spec Upper Max</FieldLabel>
                          <TextInput type="number" step="0.001" value={gSpecUpperMax} disabled={!calibBlockEnabled} onChange={(e) => setGSpecUpperMax(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Wear Limit Lower Max</FieldLabel>
                          <TextInput type="number" step="0.001" value={wLimitLowerMax} disabled={!calibBlockEnabled} onChange={(e) => setWLimitLowerMax(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Wear Limit Upper Min</FieldLabel>
                          <TextInput type="number" step="0.001" value={wLimitUpperMin} disabled={!calibBlockEnabled} onChange={(e) => setWLimitUpperMin(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Wear Limit Upper Max</FieldLabel>
                          <TextInput type="number" step="0.001" value={wLimitUpperMax} disabled={!calibBlockEnabled} onChange={(e) => setWLimitUpperMax(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Product Spec Lower Max</FieldLabel>
                          <TextInput type="number" step="0.001" value={prodSpecLowerMax} disabled={!calibBlockEnabled} onChange={(e) => setProdSpecLowerMax(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Product Spec Upper Min</FieldLabel>
                          <TextInput type="number" step="0.001" value={prodSpecUpperMin} disabled={!calibBlockEnabled} onChange={(e) => setProdSpecUpperMin(Number(e.target.value))} />
                        </div>
                        <div>
                          <FieldLabel>Product Spec Upper Max</FieldLabel>
                          <TextInput type="number" step="0.001" value={prodSpecUpperMax} disabled={!calibBlockEnabled} onChange={(e) => setProdSpecUpperMax(Number(e.target.value))} />
                        </div>
                      </div>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)]">
                          Gauge / wear / product specs are hidden for this tools type.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "preventive" && showPreventiveTab && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <p className="text-xs text-[var(--text-muted)]">
                      Controlled by <span className="font-semibold">Is Asset</span> on Stock &amp; Flags
                      {!prevBlockEnabled && " — set Is Asset to Yes to edit these fields"}
                      {". "}
                      Flow (no extra screens): save frequency → units get <span className="font-mono">Nxt PreMNT</span> →
                      on tool view click <span className="font-semibold">Complete PM</span> to advance next due.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel>Preventive MNT Method</FieldLabel>
                        <SelectInput
                          value={preventiveMethod}
                          disabled={!prevBlockEnabled}
                          onChange={(e) => setPreventiveMethod(e.target.value)}
                        >
                          {PREV_METHOD_OPTIONS.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Preventive MNT Frequency (Months)</FieldLabel>
                        <TextInput
                          type="number"
                          min={0}
                          value={preventiveFrqMonths}
                          disabled={!prevBlockEnabled}
                          onChange={(e) => setPreventiveFrqMonths(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "specs" && showSpecsTab && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div>
                      <FieldLabel>
                        Detailed Spec{typeProfile === "form" ? " (primary for this type)" : ""}
                      </FieldLabel>
                      <textarea
                        rows={typeProfile === "form" ? 6 : 4}
                        value={detailedSpec}
                        onChange={(e) => setDetailedSpec(e.target.value)}
                        className="w-full text-sm border border-[var(--border-main)] rounded-lg px-3 py-2 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] resize-none"
                        placeholder="Free-text technical description"
                      />
                    </div>
                    {typeProfile !== "consumable" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <FieldLabel>Length</FieldLabel>
                        <TextInput value={packingLength} onChange={(e) => setPackingLength(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Width</FieldLabel>
                        <TextInput value={packingWidth} onChange={(e) => setPackingWidth(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Height</FieldLabel>
                        <TextInput value={packingHeight} onChange={(e) => setPackingHeight(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Packing Dimension</FieldLabel>
                        <TextInput value={packingDimensions} onChange={(e) => setPackingDimensions(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Stiffness</FieldLabel>
                        <TextInput value={stiffness} onChange={(e) => setStiffness(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Self Life</FieldLabel>
                        <TextInput type="number" min={0} value={selfLife} onChange={(e) => setSelfLife(Number(e.target.value))} />
                      </div>
                    </div>
                    )}

                    <div className="border-t border-[var(--border-main)] pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">Technical Parameter Rows</p>
                          <p className="text-xs text-[var(--text-muted)]">Stored in TOOLS_SPECIFICATION</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSpecs([...specs, { name: "", value: "", unit: "" }])}
                          className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-4 h-4" /> Add Detail
                        </button>
                      </div>
                      <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                              {["Detail Name", "Detail Value", "Unit", ""].map((col) => (
                                <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-4">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-main)]">
                            {specs.map((item, index) => (
                              <tr key={index}>
                                <td className="py-2.5 px-3">
                                  <TextInput
                                    value={item.name}
                                    onChange={(e) => {
                                      const list = [...specs];
                                      list[index].name = e.target.value;
                                      setSpecs(list);
                                    }}
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <TextInput
                                    value={item.value}
                                    onChange={(e) => {
                                      const list = [...specs];
                                      list[index].value = e.target.value;
                                      setSpecs(list);
                                    }}
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <TextInput
                                    value={item.unit}
                                    onChange={(e) => {
                                      const list = [...specs];
                                      list[index].unit = e.target.value;
                                      setSpecs(list);
                                    }}
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const list = [...specs];
                                      list.splice(index, 1);
                                      setSpecs(list);
                                    }}
                                    className="p-1 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)]"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {specs.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-xs text-[var(--text-muted)]">
                                  No technical detail rows yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {showUnitHistoryTable && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {calibBlockEnabled ? "Individual Serial Units & Calibration History" : "Individual Serial Units"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Physical units from GAUGE_SERIAL_NO (legacy bottom grid)
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] px-3 py-1 rounded-full">
                        {unitRows.length} Serialized Units
                      </span>
                    </div>

                    {!calibBlockEnabled && (
                      <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--text-muted)]">
                        Calibration tracking is not enabled for this item (History Card = No). Unit records are shown for asset tracking only.
                      </div>
                    )}

                    {!calibBlockEnabled ? null : selectedTool?.refNo ? (
                      <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Add physical unit
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div>
                            <FieldLabel>MFG / Serial No</FieldLabel>
                            <TextInput
                              value={unitForm.serialNo}
                              onChange={(e) => setUnitForm((f) => ({ ...f, serialNo: e.target.value }))}
                              placeholder="Auto if blank"
                            />
                          </div>
                          <div>
                            <FieldLabel>Make</FieldLabel>
                            <TextInput
                              value={unitForm.make}
                              onChange={(e) => setUnitForm((f) => ({ ...f, make: e.target.value }))}
                            />
                          </div>
                          <div>
                            <FieldLabel>Purchase Dt</FieldLabel>
                            <TextInput
                              type="date"
                              value={unitForm.purchaseDt}
                              onChange={(e) => setUnitForm((f) => ({ ...f, purchaseDt: e.target.value }))}
                            />
                          </div>
                          <div>
                            <FieldLabel>Nxt PreMNT Dt</FieldLabel>
                            <TextInput
                              type="date"
                              value={unitForm.nextPreDate}
                              onChange={(e) => setUnitForm((f) => ({ ...f, nextPreDate: e.target.value }))}
                            />
                          </div>
                          <div>
                            <FieldLabel>Status</FieldLabel>
                            <SelectInput
                              value={unitForm.status}
                              onChange={(e) => setUnitForm((f) => ({ ...f, status: e.target.value }))}
                            >
                              <option>AVAILABLE FOR USE</option>
                              <option>Issued</option>
                              <option>ISSUE FOR CALIBRATION</option>
                              <option>Under Repair</option>
                              <option>Scrapped</option>
                            </SelectInput>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="primary" disabled={unitSaving} onClick={handleAddUnit}>
                          {unitSaving ? "Saving…" : "Add Unit"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">
                        Save the tool first, then add physical units here.
                      </p>
                    )}

                    <div className="overflow-auto border border-[var(--border-main)] rounded-xl">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                            {["S.No", "Status", "Purchase Dt", "Make", "MFG Serial No", ...(calibBlockEnabled ? ["Lst Cali Dt", "Nxt Cali Dt"] : []), "Lst PreMNT", "Nxt PreMNT", "Issue To / DC", "PM"].map((col) => (
                              <th key={col} className="text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                          {unitRows.map((row, idx) => (
                            <tr key={row.key} className="hover:bg-[var(--bg-hover)]">
                              <td className="py-2.5 px-3 font-mono font-semibold">{idx + 1}</td>
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">{row.status}</td>
                              <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.purchaseDt}</td>
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">{row.make}</td>
                              <td className="py-2.5 px-3 font-mono font-semibold">{row.serialNo}</td>
                              {calibBlockEnabled && (
                                <>
                                  <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.lastCaliDt}</td>
                                  <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.nextCaliDt}</td>
                                </>
                              )}
                              <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.lastPreMntDt ?? "—"}</td>
                              <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.nextPreMntDt ?? "—"}</td>
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                                {row.dcNo && row.dcNo !== "—"
                                  ? `${row.issueTo ?? "—"} · ${row.dcNo}`
                                  : "In store"}
                              </td>
                              <td className="py-2.5 px-3">
                                {prevBlockEnabled && row.refNo ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleCompletePreventive(row.refNo)}
                                    className="text-[11px] font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
                                  >
                                    Complete PM
                                  </button>
                                ) : (
                                  <span className="text-[var(--text-muted)]">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {unitRows.length === 0 && (
                            <tr>
                              <td colSpan={calibBlockEnabled ? 11 : 9} className="py-6 text-center text-xs text-[var(--text-muted)]">
                                {calibBlockEnabled
                                  ? "No records found. Add a physical unit after the tool is saved."
                                  : "No records found."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--bg-app)] py-4 border-t border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => attemptLeave("list")}
                    className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                  >
                    Cancel
                  </button>
                  <Button type="submit" id="tool-save-btn" variant="primary" size="lg">
                    <Save className="w-4 h-4" /> Save Record
                  </Button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {machineModalTool && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="machine-map-title"
          >
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 id="machine-map-title" className="text-lg font-bold text-[var(--text-primary)]">
                  Machine mapping
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate font-mono">
                  {machineModalTool.toolOrGaugeNo}
                  {machineModalTool.name ? ` · ${machineModalTool.name}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMachineModalTool(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {machineError && (
                <p className="text-xs text-[var(--color-danger-text)] bg-[var(--color-danger-bg)] rounded-lg px-3 py-2">
                  {machineError}
                </p>
              )}

              {machineLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Loading machines…</p>
              ) : machineItems.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No machines mapped to this tool yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-main)] border border-[var(--border-main)] rounded-xl overflow-hidden">
                  {machineItems.map((m) => (
                    <li
                      key={m.rowId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[var(--bg-card)]"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {m.macCode || "—"}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {m.creatDt ? m.creatDt.split("T")[0] : "—"}
                        </p>
                      </div>
                      <RoleGate permission="canEditMaster">
                        <button
                          type="button"
                          disabled={machineSaving || !m.macCode}
                          onClick={() => m.macCode && void handleRemoveMachine(m.macCode)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                          title="Remove machine"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </RoleGate>
                    </li>
                  ))}
                </ul>
              )}

              <RoleGate permission="canEditMaster">
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={machineCode}
                    onChange={(e) => setMachineCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddMachine();
                      }
                    }}
                    placeholder="Machine code (MAC_CODE)"
                    maxLength={25}
                    className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-[var(--border-main)] bg-[var(--bg-surface)] font-mono"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    disabled={machineSaving || !machineCode.trim()}
                    onClick={() => void handleAddMachine()}
                  >
                    {machineSaving ? "Saving…" : "Add"}
                  </Button>
                </div>
              </RoleGate>
            </div>
          </div>
        </div>
      )}

      {leavePrompt && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-changes-title"
          >
            <h3 id="unsaved-changes-title" className="text-lg font-bold text-[var(--text-primary)]">
              Save changes?
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              You have unsaved changes to this tool record. Do you want to save before leaving?
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setLeavePrompt(null)}
                disabled={leaveSaving}
                className="px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
              >
                Stay on page
              </button>
              <button
                type="button"
                onClick={handleLeaveDiscard}
                disabled={leaveSaving}
                className="px-4 py-2.5 text-sm font-semibold text-[var(--color-danger-text)] bg-[var(--color-danger-bg)] hover:opacity-90 rounded-xl transition-all disabled:opacity-50"
              >
                Don&apos;t save
              </button>
              <Button
                type="button"
                variant="primary"
                onClick={handleLeaveSave}
                disabled={leaveSaving}
              >
                {leaveSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
