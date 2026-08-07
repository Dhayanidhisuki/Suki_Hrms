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
  ListFilter,
  Printer,
  Eraser,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { OverlayModal } from "@/components/ui/OverlayModal";
import {
  FormInput,
  FormLabel,
  FormSelect,
  FormModalSection,
  FormNumberInput,
} from "@/components/ui/form";
import { SelectionFilter } from "@/components/ui/SelectionFilter";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import { UnitHistoryTable } from "@/components/UnitHistoryTable";
import { toastSuccess, toastError } from "@/lib/appToast";
import { ERP_COMPANY_UNITS, ERP_ISSUE_TYPES } from "@/lib/toolCreate";

type ToolSatellite = null | "upload" | "mandatory";

type TabId = "general" | "stock" | "details" | "calibration" | "preventive" | "specs";

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
  preventiveFrqOthers?: number | null;
  refDetails?: string | null;
  remarks?: string | null;
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
  specifications?: {
    sequence?: number | null;
    parameter: string | null;
    specification: string | null;
    minRange?: string | null;
    maxRange?: string | null;
    wLimitLowerMin?: number | string | null;
    wLimitLowerMax?: number | string | null;
    prodSpecLowerMin?: number | string | null;
    prodSpecLowerMax?: number | string | null;
  }[];
  calibControlCard?: {
    status?: string | null;
    history?: { cDate?: string | null; nextCDate?: string | null; remarks?: string | null }[];
  } | null;
  /** Enriched by list API: next calibration due date from GAUGE_CONTROL_CARD_TRANS */
  nextCalibDate?: string | null;
  /** overdue | due-soon | ok | null */
  calibDueStatus?: "overdue" | "due-soon" | "ok" | null;
  /** Enriched by detail API: latest calibration issue/result summary */
  calibrationSummary?: {
    dcNo: number | null;
    issueDate: string | null;
    receiveName: string | null;
    issueFor: string | null;
    calibStatus: string | null;
    resultStatus: string | null;
    calibratedDate: string | null;
    calibratedBy: string | null;
    nextCalibDate: string | null;
    calibDueDate: string | null;
    certificateNo: string | null;
    comments: string | null;
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

/** ERP Tools Specification dialog row → TOOLS_SPECIFICATION */
interface ToolSpec {
  sequence: number;
  parameter: string;
  minRange: string;
  maxRange: string;
  wearLimitMin: string;
  wearLimitMax: string;
  prodSpecMin: string;
  prodSpecMax: string;
}

function emptyToolSpec(sequence = 1): ToolSpec {
  return {
    sequence,
    parameter: "",
    minRange: "",
    maxRange: "",
    wearLimitMin: "",
    wearLimitMax: "",
    prodSpecMin: "",
    prodSpecMax: "",
  };
}

function parseOptionalNumber(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function mapToolSpecsToPayload(specs: ToolSpec[]) {
  return specs
    .filter((s) => s.parameter.trim())
    .map((s, i) => ({
      sequence: s.sequence || i + 1,
      parameter: s.parameter.trim(),
      minRange: s.minRange.trim() || undefined,
      maxRange: s.maxRange.trim() || undefined,
      wLimitLowerMin: parseOptionalNumber(s.wearLimitMin),
      wLimitLowerMax: parseOptionalNumber(s.wearLimitMax),
      prodSpecLowerMin: parseOptionalNumber(s.prodSpecMin),
      prodSpecLowerMax: parseOptionalNumber(s.prodSpecMax),
    }));
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
  purchaseAt?: string;
  lastCaliDt: string;
  nextCaliDt: string;
  lastPreMntDt?: string;
  nextPreMntDt?: string;
  lastPreMntDone?: string;
  nextPreMntDone?: string;
  preMntPresentStatus?: string;
  issueTo?: string;
  dcNo?: string;
  dcDate?: string;
}

type TypeProfile = "gauge" | "form" | "consumable" | "preventive" | "it_asset" | "generic";

/**
 * Badge styles for the per-tool status roll-up computed server-side from
 * GAUGE_SERIAL_NO unit rows (GAUGEANDTOOLS.STATUS is never used — it carries
 * no lifecycle signal in the ERP data).
 */
const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  "In Calibration": {
    bg: "bg-violet-50 dark:bg-violet-950/30 border border-violet-300 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  "Needs Attention": {
    bg: "bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  Available: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  "In Use": {
    bg: "bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  Inactive: {
    bg: "bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  "No Units": {
    bg: "bg-[var(--bg-subtle)] border border-[var(--border-main)]",
    text: "text-[var(--text-muted)]",
    dot: "bg-slate-300",
  },
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

/** Keep editable grid dates as YYYY-MM-DD (avoids en-IN ↔ date-input round-trip bugs). */
function toIsoDateValue(value: string | Date | null | undefined): string {
  if (!value || value === "—") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "";
  return toIsoDateValue(d);
}

function addMonthsIso(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  return toIsoDateValue(d);
}

function resolveTypeProfile(type: string, group: string, assetCategory?: string | null): TypeProfile {
  const source = `${normalizeText(type)} ${normalizeText(group)} ${normalizeText(assetCategory)}`;
  if (
    ["laptop", "mobile", "it asset", "computer", "tablet", "printer", "electronics", "hardware", "phone", "desktop"].some((k) => source.includes(k)) ||
    normalizeText(group) === "it assets" ||
    normalizeText(group) === "it asset"
  ) {
    return "it_asset";
  }
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

function buildUnitHistoryRows(tool: GaugeAndTool, calibFrqMonths = 0): UnitHistoryRow[] {
  const latestHistory = tool.calibControlCard?.history?.[0];
  const cardLast = toIsoDateValue(latestHistory?.cDate) || "—";
  const cardNext = toIsoDateValue(latestHistory?.nextCDate) || "—";
  const frq = calibFrqMonths || tool.calibrationFrqMonths || 0;

  if (tool.unitHistory && tool.unitHistory.length > 0) {
    return tool.unitHistory.map((row) => {
      const purchaseIso = toIsoDateValue(row.purchaseDt) || "—";
      const last = toIsoDateValue(row.lastCaliDt) || (cardLast !== "—" ? cardLast : "—");
      let next = toIsoDateValue(row.nextCaliDt) || (cardNext !== "—" ? cardNext : "—");

      if ((!next || next === "—") && frq > 0 && purchaseIso !== "—") {
        next = addMonthsIso(purchaseIso, frq) || "—";
      }

      return {
        ...row,
        refNo: row.refNo,
        purchaseDt: purchaseIso,
        purchaseAt: row.purchaseAt || "—",
        lastCaliDt: last || "—",
        nextCaliDt: next || "—",
        lastPreMntDt: toIsoDateValue(row.lastPreMntDt) || "—",
        nextPreMntDt: toIsoDateValue(row.nextPreMntDt) || "—",
        lastPreMntDone: row.lastPreMntDone || "—",
        nextPreMntDone: row.nextPreMntDone || "—",
        preMntPresentStatus: row.preMntPresentStatus || "—",
        issueTo: row.issueTo || "—",
        dcNo: row.dcNo || "—",
        dcDate: toIsoDateValue(row.dcDate) || "—",
      };
    });
  }
  const serials = tool.serialNumbers ?? [];
  if (serials.length === 0) return [];
  return serials.map((s) => {
    const purchaseIso = toIsoDateValue(s.purchaseDt) || "—";
    let next = cardNext;
    if ((!next || next === "—") && frq > 0 && purchaseIso !== "—") {
      next = addMonthsIso(purchaseIso, frq) || "—";
    }
    return {
      key: String(s.refNo),
      refNo: s.refNo,
      serialNo: s.serialNo != null ? String(s.serialNo) : "—",
      status: s.status || "—",
      make: s.make || "—",
      purchaseDt: purchaseIso,
      purchaseAt: "—",
      lastCaliDt: cardLast,
      nextCaliDt: next || "—",
      lastPreMntDt: "—",
      nextPreMntDt: toIsoDateValue(s.nextPreDate) || "—",
      lastPreMntDone: "—",
      nextPreMntDone: "—",
      preMntPresentStatus: "—",
      issueTo: "—",
      dcNo: "—",
      dcDate: "—",
    };
  });
}

/** ERP-like: unit grid follows Total Qty when Serial Gen = Yes (fills missing as planned rows). */
function buildQtyMatchedUnitRows(
  existing: UnitHistoryRow[],
  totQty: number,
  serialGenOn: boolean,
  calibFrqMonths = 0,
  unitFormPurchaseDt = ""
): UnitHistoryRow[] {
  if (!serialGenOn) return existing;
  const target = Math.max(0, Math.floor(Number(totQty) || 0));
  if (target <= 0) return existing;

  const bySerial = new Map<string, UnitHistoryRow>();
  for (const row of existing) {
    const sn = String(row.serialNo ?? "").trim();
    if (sn && sn !== "—") bySerial.set(sn, row);
  }

  const rows: UnitHistoryRow[] = [];
  for (let i = 1; i <= target; i++) {
    const key = String(i);
    const found = bySerial.get(key);
    if (found) {
      let next = found.nextCaliDt;
      if ((!next || next === "—") && calibFrqMonths > 0) {
        const pDt =
          found.purchaseDt !== "—"
            ? toIsoDateValue(found.purchaseDt)
            : toIsoDateValue(unitFormPurchaseDt);
        if (pDt) {
          next = addMonthsIso(pDt, calibFrqMonths) || "—";
        }
      }
      rows.push({ ...found, purchaseDt: toIsoDateValue(found.purchaseDt) || found.purchaseDt, nextCaliDt: next || "—" });
      bySerial.delete(key);
    } else {
      let plannedNext = "—";
      const pDt = toIsoDateValue(unitFormPurchaseDt);
      if (calibFrqMonths > 0 && pDt) {
        plannedNext = addMonthsIso(pDt, calibFrqMonths) || "—";
      }
      rows.push({
        key: `planned-${i}`,
        serialNo: key,
        status: "AVAILABLE FOR USE",
        make: "—",
        purchaseDt: pDt || "—",
        purchaseAt: "—",
        lastCaliDt: "—",
        nextCaliDt: plannedNext,
        lastPreMntDt: "—",
        nextPreMntDt: "—",
        lastPreMntDone: "—",
        nextPreMntDone: "—",
        preMntPresentStatus: "—",
        issueTo: "In store",
        dcNo: "—",
        dcDate: "—",
      });
    }
  }
  // Keep any extra saved units beyond Tot Qty (never hide real data)
  for (const row of bySerial.values()) {
    rows.push(row);
  }
  return rows;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <FormLabel>{children}</FormLabel>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <FormInput {...props} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <FormSelect {...props} />;
}

/** Number field without browser steppers; select-all on focus avoids "010000" from a leading 0. */
function NumInput({
  value,
  onValueChange,
  min = 0,
  integer,
  disabled,
  className,
  step: _step,
}: {
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  integer?: boolean;
  disabled?: boolean;
  className?: string;
  /** Ignored — kept for call-site compatibility with old type=number fields */
  step?: string | number;
}) {
  void _step;
  return (
    <FormNumberInput
      value={value}
      onValueChange={onValueChange}
      min={min}
      integer={integer}
      disabled={disabled}
      className={className}
    />
  );
}

export default function ToolsMasterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tools, setTools] = useState<GaugeAndTool[]>([]);
  const [toolsGroups, setToolsGroups] = useState<ToolsGroup[]>([]);
  const [toolsSubgroups, setToolsSubgroups] = useState<ToolsSubgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [groupFilter, setGroupFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [nameFilter, setNameFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [onlyActive, setOnlyActive] = useState(true);
  const [criticalFilter, setCriticalFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "toolno" | "name" | "group">("newest");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [viewState, setViewState] = useState<"list" | "create" | "edit" | "view">("list");
  const [selectedTool, setSelectedTool] = useState<GaugeAndTool | null>(null);
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
  /** ERP toolsmanagecreation footer satellites */
  const [satellite, setSatellite] = useState<ToolSatellite>(null);
  /** Collapsible add/edit form sections — Tool details stays sticky + open by default */
  const [formSectionsOpen, setFormSectionsOpen] = useState({
    core: true,
    stock: true,
    details: true,
    calibration: true,
    preventive: true,
    specs: true,
    units: true,
  });
  const [showAddName, setShowAddName] = useState(false);
  const [newToolName, setNewToolName] = useState("");
  const [savingToolName, setSavingToolName] = useState(false);
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
  /** Search labels inside Add/Edit tool form */
  const [formFieldQuery, setFormFieldQuery] = useState("");
  const [formFieldHitCount, setFormFieldHitCount] = useState(0);
  const [formFieldActiveIdx, setFormFieldActiveIdx] = useState(0);
  const formFieldHitsRef = useRef<HTMLElement[]>([]);

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
  const [stockItem, setStockItem] = useState("Y");
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

  // Tools Details satellite (TOOLS_DETAILS)
  const [detailNoOfCavity, setDetailNoOfCavity] = useState(0);
  const [detailRunningCavity, setDetailRunningCavity] = useState(0);
  const [detailToolLife, setDetailToolLife] = useState(0);
  const [detailBalanceToolLife, setDetailBalanceToolLife] = useState(0);
  const [detailHardness, setDetailHardness] = useState("");
  const [detailDrawingNo, setDetailDrawingNo] = useState("");

  // Calibration / Preventive
  const [calibrationFrqMonths, setCalibrationFrqMonths] = useState(0);
  const [caliPlannedWho, setCaliPlannedWho] = useState("N/A");
  const [calibrationResponsibility, setCalibrationResponsibility] = useState("N/A");
  const [historyCardReq, setHistoryCardReq] = useState("No");
  const [preventiveMethod, setPreventiveMethod] = useState("N/A");
  const [preventiveFrqMonths, setPreventiveFrqMonths] = useState(0);
  const [preventiveFrqOthers, setPreventiveFrqOthers] = useState(0);
  const [refDetails, setRefDetails] = useState("");
  const [remarks, setRemarks] = useState("");
  const [gSpecUpperMin, setGSpecUpperMin] = useState(0);
  const [gSpecUpperMax, setGSpecUpperMax] = useState(0);
  const [wLimitLowerMax, setWLimitLowerMax] = useState(0);
  const [wLimitUpperMin, setWLimitUpperMin] = useState(0);
  const [wLimitUpperMax, setWLimitUpperMax] = useState(0);
  const [prodSpecLowerMax, setProdSpecLowerMax] = useState(0);
  const [prodSpecUpperMin, setProdSpecUpperMin] = useState(0);
  const [prodSpecUpperMax, setProdSpecUpperMax] = useState(0);

  const setFormRoute = useCallback(
    (next: "list" | "add" | { edit: number }) => {
      const base = "/dashboard/masters/tools";
      if (next === "list") {
        router.replace(base, { scroll: false });
      } else if (next === "add") {
        router.replace(`${base}?action=add`, { scroll: false });
      } else {
        router.replace(`${base}?action=edit&refNo=${next.edit}`, { scroll: false });
      }
    },
    [router]
  );

  const loadTools = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("search", query.trim());
      if (searchField !== "all") params.set("searchField", searchField);
    }
    if (groupFilter !== "All") params.set("grouping", groupFilter);
    if (typeFilter !== "All") params.set("type", typeFilter);
    if (nameFilter !== "All") params.set("name", nameFilter);
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (onlyActive) params.set("onlyActive", "1");
    if (criticalFilter === "Yes" || criticalFilter === "No") params.set("critical", criticalFilter);
    if (deptFilter !== "All") params.set("department", deptFilter);
    params.set("sort", sortBy);
    params.set("includeCounts", "1");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await apiGet<{
      items: GaugeAndTool[];
      total?: number;
      statusCounts?: Record<string, number>;
    }>(`/api/tools?${params}`);
    if (res.data?.items) setTools(res.data.items);
    else setTools([]);
    setTotal(res.data?.total ?? 0);
    if (res.data?.statusCounts) setStatusCounts(res.data.statusCounts);
    setLoading(false);
  }, [
    query,
    searchField,
    groupFilter,
    typeFilter,
    nameFilter,
    statusFilter,
    onlyActive,
    criticalFilter,
    deptFilter,
    sortBy,
    page,
    pageSize,
  ]);

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
    setStockItem("Y");
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
    setDetailNoOfCavity(0);
    setDetailRunningCavity(0);
    setDetailToolLife(0);
    setDetailBalanceToolLife(0);
    setDetailHardness("");
    setDetailDrawingNo("");
    setCalibrationFrqMonths(0);
    setCaliPlannedWho("N/A");
    setCalibrationResponsibility("N/A");
    setHistoryCardReq("No");
    setPreventiveMethod("N/A");
    setPreventiveFrqMonths(0);
    setPreventiveFrqOthers(0);
    setRefDetails("");
    setRemarks("");
    setGSpecUpperMin(0);
    setGSpecUpperMax(0);
    setWLimitLowerMax(0);
    setWLimitUpperMin(0);
    setWLimitUpperMax(0);
    setProdSpecLowerMax(0);
    setProdSpecUpperMin(0);
    setProdSpecUpperMax(0);
    setSpecs([emptyToolSpec(1)]);
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
    setStockItem(
      tool.stockItem === "N" || tool.stockItem === "No" ? "N" : "Y"
    );
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
    setPreventiveFrqOthers(tool.preventiveFrqOthers ?? 0);
    setRefDetails(tool.refDetails ?? "");
    setRemarks(tool.remarks ?? "");
    setGSpecUpperMin(num(tool.gSpecUpperMin));
    setGSpecUpperMax(num(tool.gSpecUpperMax));
    setWLimitLowerMax(num(tool.wLimitLowerMax));
    setWLimitUpperMin(num(tool.wLimitUpperMin));
    setWLimitUpperMax(num(tool.wLimitUpperMax));
    setProdSpecLowerMax(num(tool.prodSpecLowerMax));
    setProdSpecUpperMin(num(tool.prodSpecUpperMin));
    setProdSpecUpperMax(num(tool.prodSpecUpperMax));
    {
      const loaded = (tool.specifications ?? []).map((s, i) => ({
        sequence: s.sequence ?? i + 1,
        parameter: s.parameter ?? "",
        minRange: s.minRange ?? "",
        maxRange: s.maxRange ?? "",
        wearLimitMin: s.wLimitLowerMin != null ? String(s.wLimitLowerMin) : "",
        wearLimitMax: s.wLimitLowerMax != null ? String(s.wLimitLowerMax) : "",
        prodSpecMin: s.prodSpecLowerMin != null ? String(s.prodSpecLowerMin) : "",
        prodSpecMax: s.prodSpecLowerMax != null ? String(s.prodSpecLowerMax) : "",
      }));
      setSpecs(loaded.length ? loaded : [emptyToolSpec(1)]);
    }
    setUnitRows(buildUnitHistoryRows(tool, tool.calibrationFrqMonths ?? 0));
    setShowSerialPreview(false);
    setErrors({});
    setActiveTab("general");
    void (async () => {
      const res = await apiGet<{
        details: {
          noOfCavity?: number | null;
          runningCavity?: number | null;
          toolLife?: number | null;
          balanceToolLife?: number | null;
          hardness?: string | null;
          drawingNo?: string | null;
        } | null;
      }>(`/api/tools/${tool.refNo}/details`);
      const d = res.data?.details;
      setDetailNoOfCavity(d?.noOfCavity ?? 0);
      setDetailRunningCavity(d?.runningCavity ?? 0);
      setDetailToolLife(d?.toolLife ?? 0);
      setDetailBalanceToolLife(d?.balanceToolLife ?? 0);
      setDetailHardness(d?.hardness ?? "");
      setDetailDrawingNo(d?.drawingNo ?? "");
    })();
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
    toastSuccess("Machine mapped");
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

  const handleSaveNewToolName = async () => {
    const trimmed = newToolName.trim();
    if (!trimmed) {
      toastError("Enter a Tools Name.");
      return;
    }
    if (!selectedGroupId || !selectedTypeId) {
      toastError("Select Tools Group and Tools Type first.");
      return;
    }
    setSavingToolName(true);
    const res = await apiPost<{
      item?: { id: number; name?: string; typeOfTools?: string };
    }>("/api/lookups/tool-types", {
      name: trimmed,
      typeOfTools: trimmed,
      itemGroupId: selectedGroupId,
      itemTypeId: selectedTypeId,
      isAutoGenCd: "Yes",
    });
    setSavingToolName(false);
    if (res.error) {
      toastError(String(res.error.message ?? "Failed to create tools name."));
      return;
    }
    const createdName = res.data?.item?.name || res.data?.item?.typeOfTools || trimmed;
    await loadLookups();
    setName(createdName);
    setShowAddName(false);
    setNewToolName("");
    toastSuccess({
      title: "Tools name added",
      message: "Saved to Tools Name for Type master and selected on this form.",
      detail: createdName,
    });
  };

  const handleCompletePreventive = async (unitRefNo?: number) => {
    if (!unitRefNo) {
      toastError("Unit reference missing — reload the tool and try again.");
      return;
    }
    const res = await apiPost<{ nextPreDate?: string }>(`/api/tools/preventive-complete`, {
      unitRefNo,
    });
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess(`Preventive MNT completed. Next due: ${res.data?.nextPreDate ?? "updated"}.`);
    if (selectedTool?.refNo) await reloadSelectedToolUnits(selectedTool.refNo);
  };

  const handleAddUnit = async () => {
    if (!selectedTool?.refNo) {
      toastError("Save the tool first, then add physical units.");
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
      toastSuccess("Physical unit added.");
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
      toastError(err instanceof Error ? err.message : "Failed to add unit");
    } finally {
      setUnitSaving(false);
    }
  };

  const handleUpdatePurchaseDt = async (refNo: number | undefined, key: string, newPurchaseDt: string) => {
    const iso = toIsoDateValue(newPurchaseDt);
    setUnitRows((prev) => {
      const matchIdx = prev.findIndex(
        (row) => (refNo != null && row.refNo === refNo) || row.key === key
      );
      const nextCali =
        calibrationFrqMonths > 0 && iso ? addMonthsIso(iso, calibrationFrqMonths) || "—" : undefined;

      if (matchIdx >= 0) {
        return prev.map((row, i) =>
          i === matchIdx
            ? {
                ...row,
                purchaseDt: iso || "—",
                ...(nextCali ? { nextCaliDt: nextCali } : {}),
              }
            : row
        );
      }

      const serialNo = key.startsWith("planned-") ? key.replace(/^planned-/, "") : key;
      return [
        ...prev,
        {
          key,
          refNo,
          serialNo,
          status: "AVAILABLE FOR USE",
          make: "—",
          purchaseDt: iso || "—",
          purchaseAt: "—",
          lastCaliDt: "—",
          nextCaliDt: nextCali || "—",
          lastPreMntDt: "—",
          nextPreMntDt: "—",
          lastPreMntDone: "—",
          nextPreMntDone: "—",
          preMntPresentStatus: "—",
          issueTo: "In store",
          dcNo: "—",
          dcDate: "—",
        },
      ];
    });

    if (iso) {
      setUnitForm((f) => ({ ...f, purchaseDt: iso }));
    }

    if (refNo && selectedTool?.refNo && iso) {
      try {
        const res = await apiPut<{ unitHistory?: UnitHistoryRow[] }>(
          `/api/tools/${selectedTool.refNo}/serials`,
          { refNo, purchaseDt: iso }
        );
        if (res.data?.unitHistory) {
          setUnitRows(buildUnitHistoryRows({ ...selectedTool, unitHistory: res.data.unitHistory }, calibrationFrqMonths));
        }
        toastSuccess("Purchase date updated & Next Calibration Date calculated.");
      } catch (err) {
        console.warn("Failed to persist serial purchase date:", err);
        toastError("Could not save purchase date.");
      }
    }
  };

  const handleUpdateUnitProp = async (
    refNo: number | undefined,
    key: string,
    field: keyof UnitHistoryRow,
    value: string,
    sourceRow?: UnitHistoryRow
  ) => {
    const isDateField =
      field === "purchaseDt" ||
      field === "lastCaliDt" ||
      field === "nextCaliDt" ||
      field === "lastPreMntDt" ||
      field === "nextPreMntDt" ||
      field === "dcDate";
    const normalized = isDateField ? toIsoDateValue(value) || "—" : value || "—";

    setUnitRows((prev) => {
      const matchIdx = prev.findIndex(
        (row) =>
          (refNo != null && row.refNo === refNo) ||
          row.key === key ||
          (sourceRow?.serialNo &&
            sourceRow.serialNo !== "—" &&
            row.serialNo === sourceRow.serialNo)
      );

      const apply = (row: UnitHistoryRow): UnitHistoryRow => {
        const updated: UnitHistoryRow = { ...row, [field]: normalized };

        if (field === "purchaseDt" || field === "lastCaliDt") {
          if (calibrationFrqMonths > 0) {
            const base =
              field === "lastCaliDt"
                ? toIsoDateValue(normalized)
                : toIsoDateValue(
                    updated.lastCaliDt !== "—" ? updated.lastCaliDt : normalized
                  );
            if (base) {
              updated.nextCaliDt = addMonthsIso(base, calibrationFrqMonths) || updated.nextCaliDt;
            }
          }
        }

        if (field === "lastPreMntDt" && preventiveFrqMonths > 0) {
          const base = toIsoDateValue(normalized);
          if (base) {
            updated.nextPreMntDt = addMonthsIso(base, preventiveFrqMonths) || updated.nextPreMntDt;
          }
        }

        return updated;
      };

      if (matchIdx >= 0) {
        return prev.map((row, i) => (i === matchIdx ? apply(row) : row));
      }

      const base: UnitHistoryRow = sourceRow
        ? { ...sourceRow, key: sourceRow.key || key, refNo: sourceRow.refNo ?? refNo }
        : {
            key,
            refNo,
            serialNo: key.startsWith("planned-") ? key.replace(/^planned-/, "") : String(key),
            status: "AVAILABLE FOR USE",
            make: "—",
            purchaseDt: "—",
            purchaseAt: "—",
            lastCaliDt: "—",
            nextCaliDt: "—",
            lastPreMntDt: "—",
            nextPreMntDt: "—",
            lastPreMntDone: "—",
            nextPreMntDone: "—",
            preMntPresentStatus: "—",
            issueTo: "In store",
            dcNo: "—",
            dcDate: "—",
          };

      return [...prev, apply(base)];
    });

    if (field === "purchaseDt" && normalized !== "—") {
      setUnitForm((f) => ({ ...f, purchaseDt: normalized }));
    }

    if (refNo && selectedTool?.refNo) {
      try {
        const payload: Record<string, unknown> = {
          refNo,
          [field]: normalized === "—" ? null : normalized,
        };
        const res = await apiPut<{ unitHistory?: UnitHistoryRow[] }>(
          `/api/tools/${selectedTool.refNo}/serials`,
          payload
        );
        if (res.data?.unitHistory) {
          setUnitRows(buildUnitHistoryRows({ ...selectedTool, unitHistory: res.data.unitHistory }, calibrationFrqMonths));
        }
      } catch (err) {
        console.warn("Failed to persist unit row update:", err);
        toastError("Could not save unit change.");
      }
    }
  };

  const openCreateState = useCallback(() => {
    setSelectedTool(null);
    resetForm();
    setFormEntryKey(`create-${Date.now()}`);
    setFormFieldQuery("");
    setViewState("create");
  }, [resetForm]);

  const handleOpenAdd = useCallback(() => {
    openCreateState();
    setFormRoute("add");
  }, [openCreateState, setFormRoute]);

  const openEditState = useCallback((t: GaugeAndTool) => {
    fillForm(t);
    setSelectedTool(t);
    setFormEntryKey(`edit-${t.refNo}`);
    setFormFieldQuery("");
    setViewState("edit");
  }, []);

  const handleOpenEdit = useCallback(
    (t: GaugeAndTool) => {
      openEditState(t);
      setFormRoute({ edit: t.refNo });
    },
    [openEditState, setFormRoute]
  );

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
      stockItem,
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
      preventiveFrqOthers,
      refDetails,
      remarks,
      gSpecUpperMin,
      gSpecUpperMax,
      wLimitLowerMax,
      wLimitUpperMin,
      wLimitUpperMax,
      prodSpecLowerMax,
      prodSpecUpperMin,
      prodSpecUpperMax,
      specifications: mapToolSpecsToPayload(specs),
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
    stockItem,
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
    preventiveFrqOthers,
    refDetails,
    remarks,
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

  const executeLeave = useCallback(
    (target: LeaveTarget) => {
      setLeavePrompt(null);
      setErrors({});
      if (target === "list") {
        setViewState("list");
        setSelectedTool(null);
        setFormRoute("list");
      } else {
        setViewState("view");
        setFormRoute("list");
      }
    },
    [setFormRoute]
  );

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
    const action = searchParams.get("action");
    if (action === "add") {
      if (viewState !== "create") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        openCreateState();
      }
      return;
    }
    if (action === "edit") {
      const refNo = Number(searchParams.get("refNo"));
      if (!Number.isFinite(refNo) || refNo <= 0) return;
      if (viewState === "edit" && selectedTool?.refNo === refNo) return;
      void (async () => {
        const res = await apiGet<{ tool: GaugeAndTool }>(`/api/tools/${refNo}`);
        if (res.data?.tool) openEditState(res.data.tool);
      })();
      return;
    }
    // Browser back / URL cleared while overlay open
    if (viewState === "create" || viewState === "edit") {
      setViewState("list");
      setSelectedTool(null);
      setErrors({});
      setLeavePrompt(null);
    }
    // Intentionally omit open* from deps — URL is the source of truth here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    if (typeProfile !== "it_asset" && typeProfile !== "consumable" && historyCardReq === "Yes" && calibrationFrqMonths <= 0) {
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
      stockItem: stockItem === "N" ? "N" : "Y",
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
      preventiveFrqOthers,
      refDetails: refDetails.trim() || null,
      remarks: remarks.trim() || null,
      gSpecUpperMin,
      gSpecUpperMax,
      wLimitLowerMax,
      wLimitUpperMin,
      wLimitUpperMax,
      prodSpecLowerMax,
      prodSpecUpperMin,
      specifications: mapToolSpecsToPayload(specs),
      unitPurchaseDt: (() => {
        // Prefer per-row edited purchase dates (ISO). Do not force "today" over a past date.
        const fromRows = displayUnitRows
          .map((r) => toIsoDateValue(r.purchaseDt))
          .filter(Boolean);
        const fromForm = toIsoDateValue(unitForm.purchaseDt);
        return fromRows[0] || fromForm || undefined;
      })(),
    };

    const res = selectedTool
      ? await apiPut<{ tool: GaugeAndTool }>(`/api/tools/${selectedTool.refNo}`, payload)
      : await apiPost<{ tool: GaugeAndTool }>("/api/tools", payload);

    if (res.error) {
      const message =
        typeof res.error.message === "string"
          ? res.error.message
          : "Unable to save tool. Check required fields.";
      toastError(message);
      return false;
    }

    const saved = res.data?.tool;
    if (saved?.refNo) {
      const hasDetailsPayload =
        detailNoOfCavity > 0 ||
        detailRunningCavity > 0 ||
        detailToolLife > 0 ||
        detailBalanceToolLife > 0 ||
        detailHardness.trim() !== "" ||
        detailDrawingNo.trim() !== "";
      if (hasDetailsPayload || selectedTool) {
        await apiPut(`/api/tools/${saved.refNo}/details`, {
          noOfCavity: detailNoOfCavity || undefined,
          runningCavity: detailRunningCavity || undefined,
          toolLife: detailToolLife || undefined,
          balanceToolLife: detailBalanceToolLife || undefined,
          hardness: detailHardness.trim() || undefined,
          drawingNo: detailDrawingNo.trim() || undefined,
        });
      }
    }
    toastSuccess({
      title: "Record saved",
      message: selectedTool ? "Tool record updated successfully." : "Tool record created successfully.",
      detail: saved?.toolOrGaugeNo || undefined,
    });
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
        setFormRoute({ edit: toolData.refNo });
      }
    } else if (opts?.leaveAfter) {
      executeLeave(opts.leaveAfter);
    } else {
      setViewState("list");
      setFormRoute("list");
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
      toastError(String(res.error.message));
      return;
    }
    toastSuccess("Tool deleted.");
    loadTools();
  };

  const clearFormFieldHighlights = useCallback(() => {
    const form = document.getElementById("tool-master-form");
    if (!form) return;
    form.querySelectorAll("[data-field-hit]").forEach((el) => {
      el.removeAttribute("data-field-hit");
      el.classList.remove("tool-field-hit", "tool-field-hit-active");
    });
    form.querySelectorAll("[data-field-dim]").forEach((el) => {
      el.removeAttribute("data-field-dim");
      el.classList.remove("tool-field-dim");
    });
    form.querySelectorAll("[data-section-hit]").forEach((el) => {
      el.removeAttribute("data-section-hit");
      el.classList.remove("tool-section-hit");
    });
    formFieldHitsRef.current = [];
  }, []);

  const collectFormFieldHits = useCallback((needle: string): HTMLElement[] => {
    const form = document.getElementById("tool-master-form");
    if (!form || !needle) return [];
    const q = needle.trim().toLowerCase();
    if (!q) return [];

    const hits: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();

    form.querySelectorAll("label.form-label").forEach((label) => {
      const text = (label.textContent || "").replace(/\*/g, "").trim().toLowerCase();
      if (!text.includes(q)) return;
      const cell = label.parentElement;
      if (!(cell instanceof HTMLElement) || seen.has(cell)) return;
      seen.add(cell);
      hits.push(cell);
    });

    // Section headings (e.g. "Calibration", "Stock")
    form.querySelectorAll(".form-modal-section").forEach((section) => {
      if (!(section instanceof HTMLElement)) return;
      const titleEl = section.querySelector("h3");
      const title = (titleEl?.textContent || "").trim().toLowerCase();
      if (!title.includes(q)) return;
      section.setAttribute("data-section-hit", "1");
      section.classList.add("tool-section-hit");
    });

    return hits;
  }, []);

  const applyFormFieldSearch = useCallback(
    (needle: string, preferredIdx = 0) => {
      clearFormFieldHighlights();
      const q = needle.trim();
      if (!q) {
        setFormFieldHitCount(0);
        setFormFieldActiveIdx(0);
        return;
      }

      const hits = collectFormFieldHits(q);
      formFieldHitsRef.current = hits;
      hits.forEach((cell) => {
        cell.setAttribute("data-field-hit", "1");
        cell.classList.add("tool-field-hit");
      });

      // Dim non-matching field cells that have a label
      const form = document.getElementById("tool-master-form");
      form?.querySelectorAll("label.form-label").forEach((label) => {
        const cell = label.parentElement;
        if (!(cell instanceof HTMLElement)) return;
        if (cell.hasAttribute("data-field-hit")) return;
        cell.setAttribute("data-field-dim", "1");
        cell.classList.add("tool-field-dim");
      });

      setFormFieldHitCount(hits.length);
      if (hits.length === 0) {
        setFormFieldActiveIdx(0);
        return;
      }
      const idx = ((preferredIdx % hits.length) + hits.length) % hits.length;
      setFormFieldActiveIdx(idx);
      hits.forEach((cell, i) => {
        cell.classList.toggle("tool-field-hit-active", i === idx);
      });
      hits[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = hits[idx]?.querySelector(
        "input, select, textarea, button"
      ) as HTMLElement | null;
      focusable?.focus({ preventScroll: true });
    },
    [clearFormFieldHighlights, collectFormFieldHits]
  );

  const jumpFormFieldHit = (dir: 1 | -1) => {
    const hits = formFieldHitsRef.current;
    if (hits.length === 0) return;
    const next = (formFieldActiveIdx + dir + hits.length) % hits.length;
    hits.forEach((cell, i) => {
      cell.classList.toggle("tool-field-hit-active", i === next);
    });
    setFormFieldActiveIdx(next);
    hits[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = hits[next]?.querySelector(
      "input, select, textarea, button"
    ) as HTMLElement | null;
    focusable?.focus({ preventScroll: true });
  };

  // When searching fields, expand every section then highlight matches
  useEffect(() => {
    if (viewState !== "create" && viewState !== "edit") {
      clearFormFieldHighlights();
      return;
    }
    const q = formFieldQuery.trim();
    if (!q) {
      clearFormFieldHighlights();
      setFormFieldHitCount(0);
      setFormFieldActiveIdx(0);
      return;
    }
    setFormSectionsOpen({
      core: true,
      stock: true,
      details: true,
      calibration: true,
      preventive: true,
      specs: true,
      units: true,
    });
    const t = window.setTimeout(() => applyFormFieldSearch(q, 0), 60);
    return () => window.clearTimeout(t);
  }, [formFieldQuery, viewState, applyFormFieldSearch, clearFormFieldHighlights]);

  const scrollToToolSection = (id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const setFormSectionOpen = (key: keyof typeof formSectionsOpen, open: boolean) => {
    setFormSectionsOpen((prev) => ({ ...prev, [key]: open }));
  };

  const allFormSectionsOpen = Object.values(formSectionsOpen).every(Boolean);
  const toggleAllFormSections = () => {
    if (allFormSectionsOpen) {
      // Collapse others; keep Tool details open (sticky primary block)
      setFormSectionsOpen({
        core: true,
        stock: false,
        details: false,
        calibration: false,
        preventive: false,
        specs: false,
        units: false,
      });
      return;
    }
    setFormSectionsOpen({
      core: true,
      stock: true,
      details: true,
      calibration: true,
      preventive: true,
      specs: true,
      units: true,
    });
  };

  const expandAndScrollSection = (
    key: keyof typeof formSectionsOpen,
    id: string
  ) => {
    setFormSectionOpen(key, true);
    // Wait for collapsed content to mount before scrolling
    window.setTimeout(() => scrollToToolSection(id), 40);
  };

  const handleClearForm = () => {
    if (!confirm("Clear all fields on this form?")) return;
    if (viewState === "edit" && selectedTool) {
      fillForm(selectedTool);
      toastSuccess("Form restored from saved tool.");
    } else {
      resetForm();
      toastSuccess("Form cleared.");
    }
  };

  const handlePrintToolForm = () => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!w) {
      toastError("Pop-up blocked — allow pop-ups to print.");
      return;
    }
    const esc = (v: unknown) =>
      String(v ?? "—")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const rows = [
      ["Description", description],
      ["Tool Group", grouping],
      ["Tool Type", type],
      ["Tool Number", toolOrGaugeNo],
      ["Tools Name", name],
      ["Issue Type", issueType],
      ["Total Qty", totQty],
      ["UOM", uom],
      ["History Card", historyCardReq],
      ["Serial Gen", serialNoGenReq ? "Yes" : "No"],
      ["Active", activeItem],
      ["Location", locationName || location],
    ];
    const specHtml = specs
      .filter((s) => s.parameter.trim())
      .map(
        (s) =>
          `<tr><td>${esc(s.sequence)}</td><td>${esc(s.parameter)}</td><td>${esc(s.minRange)}</td><td>${esc(s.maxRange)}</td><td>${esc(s.wearLimitMin)}</td><td>${esc(s.wearLimitMax)}</td><td>${esc(s.prodSpecMin)}</td><td>${esc(s.prodSpecMax)}</td></tr>`
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>${esc(toolOrGaugeNo || "Tool")}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#555}
        table{border-collapse:collapse;width:100%;font-size:12px}
        td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f5f5f5}
        .meta td:first-child{width:180px;font-weight:600;color:#444;background:#fafafa}
      </style></head><body>
      <h1>QMS Tools / Item Asset Master</h1>
      <p style="color:#666;font-size:12px;margin:0 0 16px">${esc(new Date().toLocaleString())}</p>
      <h2>Master fields</h2>
      <table class="meta">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
      <h2>Tools Specification</h2>
      <table><thead><tr><th>Seq</th><th>Parameter</th><th>Min</th><th>Max</th><th>WL Min</th><th>WL Max</th><th>PS Min</th><th>PS Max</th></tr></thead>
      <tbody>${specHtml || `<tr><td colspan="8">No specification rows</td></tr>`}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const jumpToErpSection = (kind: "details" | "specs" | "units") => {
    if (kind === "details") {
      expandAndScrollSection("details", "tool-section-details");
      toastSuccess({
        title: "Tools Details",
        message: "Jumped to Tools Details (ERP satellite fields).",
      });
      return;
    }
    if (kind === "units") {
      expandAndScrollSection("units", "tool-section-units");
      toastSuccess({
        title: "Unit / serial grid",
        message: "Jumped to the ERP physical unit table (S.N · Status · Calib · PreMNT · DC).",
      });
      return;
    }
    expandAndScrollSection("specs", "tool-section-specs");
    toastSuccess({
      title: "Tools Specification",
      message: "Jumped to Tools Specification.",
    });
  };

  const openDocSatellite = (kind: Exclude<ToolSatellite, null>) => {
    if (!toolOrGaugeNo.trim()) {
      toastError("Enter Tool Number first — documents are keyed by tool number.");
      return;
    }
    setSatellite(kind);
  };

  const erpActionBtn =
    "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors";

  const buildExportQuery = () => {
    const params = new URLSearchParams();
    if (selectedRefNos.length > 0) {
      params.set("ids", selectedRefNos.join(","));
    } else {
      if (query) {
        params.set("search", query);
        if (searchField !== "all") params.set("searchField", searchField);
      }
      if (groupFilter !== "All") params.set("grouping", groupFilter);
      if (typeFilter !== "All") params.set("type", typeFilter);
      if (nameFilter !== "All") params.set("name", nameFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (onlyActive) params.set("onlyActive", "1");
      if (criticalFilter === "Yes" || criticalFilter === "No") params.set("critical", criticalFilter);
      if (deptFilter !== "All") params.set("department", deptFilter);
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
      toastError(err instanceof Error ? err.message : "Import preview failed");
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
      toastSuccess(`Import complete — created ${res.data?.created ?? 0}, updated ${res.data?.updated ?? 0}.`);
      setImportPreview(null);
      setImportTemplate(null);
      loadTools();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Confirm import failed");
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
    setPreventiveFrqOthers(0);
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

  // Add + Edit always show the full ERP field set (identical sections/fields).
  // View keeps type/data-based visibility.
  const isFormEdit = viewState === "create" || viewState === "edit";
  const showCalibrationTab = isFormEdit
    ? true
    : typeProfile !== "it_asset" &&
      (typeProfile === "gauge" ||
        (hasCalibrationData && typeProfile !== "consumable" && typeProfile !== "form"));

  const showPreventiveTab = isFormEdit
    ? true
    : typeProfile === "preventive" ||
      (hasPreventiveData && typeProfile !== "consumable");

  // Specs always visible on Add/Edit; disabled when History Card ≠ Yes
  const showGaugeSpecs = isFormEdit
    ? true
    : typeProfile !== "it_asset" &&
      (typeProfile === "gauge" || (hasCalibrationData && typeProfile !== "form"));
  // ERP Tools Specification (+ packing / remarks) always on Add/Edit
  const showSpecsTab = isFormEdit
    ? true
    : typeProfile !== "it_asset" &&
      (typeProfile === "form" ||
        typeProfile === "generic" ||
        typeProfile === "gauge" ||
        typeProfile === "preventive" ||
        Boolean(detailedSpec.trim()) ||
        specs.length > 0);

  // Detail-view sections (type-conditional, like the edit tabs)
  const showDetailedSpecSection = typeProfile === "form" || Boolean(detailedSpec.trim());
  const hasTechDimData =
    Boolean(drawingNo || revNoDt || stiffness || packingDimensions) ||
    Boolean(packingLength || packingWidth || packingHeight) ||
    selfLife > 0;
  const showTechDimSection = typeProfile !== "consumable" || hasTechDimData;
  const showCaliMntSection = showCalibrationTab || showPreventiveTab;
  // Always show ERP unit grid on create/edit/view (bottom of form like toolsmanagecreation)
  const showSerialUnitsSection = true;
  const showUnitHistoryTable = viewState === "create" || viewState === "edit";
  /** Live grid like ERP: when Serial Gen = Yes, show Tot Qty rows (planned until Save seeds DB). */
  const displayUnitRows = buildQtyMatchedUnitRows(unitRows, totQty, serialNoGenReq, calibrationFrqMonths, unitForm.purchaseDt);
  const plannedUnitCount = displayUnitRows.filter((r) => String(r.key).startsWith("planned-")).length;

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
    { id: "details", label: "Tools Details" },
    ...(showCalibrationTab ? [{ id: "calibration" as const, label: "Calibration" }] : []),
    ...(showPreventiveTab ? [{ id: "preventive" as const, label: "Preventive MNT" }] : []),
    ...(showSpecsTab ? [{ id: "specs" as const, label: "Tools Specification" }] : []),
  ];

  useEffect(() => {
    const visible = new Set<TabId>(["general", "stock", "details"]);
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
          {(viewState === "list" || viewState === "create" || viewState === "edit") ? (
            <>
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    Item / Asset Master
                  </h1>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    Core tool & gauge registry with stock, calibration, and unit detail
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
                    value: statusCounts.All ?? total,
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
                    value:
                      statusCounts.Available ??
                      tools.filter((t) => t.computedStatus === "Available").length,
                    subtext: "Ready for issue",
                    title: "Units ready for issue across the registry",
                    icon: CheckCircle2,
                    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                    iconColor: "text-emerald-600 dark:text-emerald-400",
                    badge: { label: "In Stock", type: "success" },
                  },
                  {
                    id: "in-use-tools",
                    label: "In Use",
                    value:
                      statusCounts["In Use"] ??
                      tools.filter((t) => t.computedStatus === "In Use").length,
                    subtext: "Issued / out of store",
                    title: "Inhouse, vendor, or new purchase",
                    icon: Cog,
                    iconBg: "bg-blue-50 dark:bg-blue-950/30",
                    iconColor: "text-blue-600 dark:text-blue-400",
                    badge: { label: "In Use", type: "info" },
                  },
                  {
                    id: "service-tools",
                    label: "Calib / Attention",
                    value:
                      statusCounts["In Calibration"] != null ||
                      statusCounts["Needs Attention"] != null
                        ? (statusCounts["In Calibration"] ?? 0) +
                          (statusCounts["Needs Attention"] ?? 0)
                        : tools.filter(
                            (t) =>
                              t.computedStatus === "In Calibration" ||
                              t.computedStatus === "Needs Attention"
                          ).length,
                    subtext: "Calibration or attention needed",
                    title: "In calibration or rejected / worn out",
                    icon: Wrench,
                    iconBg: "bg-amber-50 dark:bg-amber-950/30",
                    iconColor: "text-amber-600 dark:text-amber-400",
                    badge: { label: "Service", type: "warning" },
                  },
                ]}
              />

              <StatusPillTabs
                className="mb-3"
                idPrefix="tools-status-pill"
                size="sm"
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                items={[
                  { value: "All", label: "All", count: statusCounts.All ?? total },
                  { value: "Available", label: "Available", count: statusCounts.Available ?? 0 },
                  { value: "In Use", label: "In Use", count: statusCounts["In Use"] ?? 0 },
                  { value: "In Calibration", label: "Calibration", count: statusCounts["In Calibration"] ?? 0 },
                  { value: "Needs Attention", label: "Attention", count: statusCounts["Needs Attention"] ?? 0 },
                  { value: "Inactive", label: "Inactive", count: statusCounts.Inactive ?? 0 },
                  { value: "No Units", label: "No Units", count: statusCounts["No Units"] ?? 0 },
                ]}
              />

              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm relative animate-fade-in">
                <div className="px-3 py-2 border-b border-[var(--border-main)] flex items-center gap-2 flex-wrap sm:flex-nowrap relative z-30 min-w-0">
                  <div className="relative shrink-0 w-44">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="tools-search-input"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search"
                      className="w-full h-7 text-[11px] border border-[var(--border-main)] rounded-md pl-8 pr-2 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SelectionFilter
                      id="tools-search-field"
                      label="Field"
                      value={searchField}
                      anyValue="all"
                      anyLabel="Any"
                      maxValueWidth="4.5rem"
                      onChange={(v) => {
                        setSearchField(v);
                        setPage(1);
                      }}
                      options={[
                        { value: "all", label: "Any" },
                        { value: "toolOrGaugeNo", label: "Tool No" },
                        { value: "description", label: "Description" },
                        { value: "name", label: "Name" },
                        { value: "oldItemNo", label: "Old Item" },
                        { value: "location", label: "Location" },
                      ]}
                    />
                    <SelectionFilter
                      id="tools-group-filter"
                      label="Group"
                      value={groupFilter}
                      anyValue="All"
                      anyLabel="Any"
                      maxValueWidth="4.5rem"
                      onChange={(v) => {
                        setGroupFilter(v);
                        setTypeFilter("All");
                        setNameFilter("All");
                        setPage(1);
                      }}
                      options={[
                        { value: "All", label: "Any" },
                        ...toolsGroups.map((g) => ({ value: g.name, label: g.name })),
                      ]}
                    />
                    <SelectionFilter
                      id="tools-type-filter"
                      label="Type"
                      value={typeFilter}
                      anyValue="All"
                      anyLabel="Any"
                      maxValueWidth="4.5rem"
                      onChange={(v) => {
                        setTypeFilter(v);
                        setNameFilter("All");
                        setPage(1);
                      }}
                      options={[
                        { value: "All", label: "Any" },
                        ...toolsSubgroups
                          .filter((sg) => {
                            if (groupFilter === "All") return true;
                            const gid =
                              toolsGroups.find((g) => g.name === groupFilter)?.rowId ??
                              toolsGroups.find((g) => g.name === groupFilter)?.id;
                            return sg.refGroupId === gid || sg.group?.name === groupFilter;
                          })
                          .map((sg) => ({ value: sg.name, label: sg.name })),
                      ]}
                    />
                    <SelectionFilter
                      id="tools-critical-filter"
                      label="Critical"
                      value={criticalFilter}
                      anyValue="All"
                      anyLabel="Any"
                      maxValueWidth="3rem"
                      onChange={(v) => {
                        setCriticalFilter(v);
                        setPage(1);
                      }}
                      options={[
                        { value: "All", label: "Any" },
                        { value: "Yes", label: "Yes" },
                        { value: "No", label: "No" },
                      ]}
                    />
                    <SelectionFilter
                      id="tools-active-filter"
                      label="Active"
                      value={onlyActive ? "Yes" : "Any"}
                      anyValue="Any"
                      anyLabel="Any"
                      maxValueWidth="3.5rem"
                      onChange={(v) => {
                        setOnlyActive(v === "Yes");
                        setPage(1);
                      }}
                      options={[
                        { value: "Any", label: "Any" },
                        { value: "Yes", label: "Yes" },
                      ]}
                    />
                    <SelectionFilter
                      id="tools-sort-filter"
                      label="Sort"
                      value={sortBy}
                      anyValue="newest"
                      anyLabel="Newest"
                      maxValueWidth="3.5rem"
                      onChange={(v) => {
                        setSortBy(v as "newest" | "toolno" | "name" | "group");
                        setPage(1);
                      }}
                      options={[
                        { value: "newest", label: "Newest" },
                        { value: "toolno", label: "Tool No" },
                        { value: "name", label: "Name" },
                        { value: "group", label: "Group" },
                      ]}
                    />
                    <div className="relative">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 !rounded-md !px-2 !text-[11px]"
                        disabled={!!importBusy || !!exportBusy}
                        onClick={() => setShowImportChooser((v) => !v)}
                      >
                        <ListFilter className="w-3 h-3" />
                        Import
                      </Button>
                      {showImportChooser && (
                        <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-lg p-2 space-y-1">
                          <RoleGate permission="canEditMaster">
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
                                  <p className="text-sm font-semibold">{opt.title}</p>
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
                          </RoleGate>
                          <div className="flex gap-2 p-1">
                            <Button type="button" size="sm" variant="ghost" className="flex-1" disabled={!!exportBusy} onClick={() => runExport("xlsx")}>
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              Excel
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="flex-1" disabled={!!exportBusy} onClick={() => runExport("pdf")}>
                              <FileText className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                          </div>
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
                  </div>
                </div>

                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
                />

                <div className="px-4 pt-3">
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
                </div>

                {loading ? (
                  <div className="px-4 pb-4"><TableSkeleton rows={6} /></div>
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
                            "Tool Group",
                            "Tool Type",
                            "Type Name",
                            "Old Item No",
                            "UOM",
                            "Total Qty",
                            "Avail.For.Iss.",
                            "Location",
                            "Loc. Output",
                            "Ret?",
                            "Sl.No?",
                            "Issue Type",
                            "Critical?",
                            "PS.Min",
                            "PS.Max",
                            "Ref. No",
                            "Least Count",
                            "Buffer Qty",
                            "Next Calib Due",
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
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                                {t.grouping || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                                {t.type || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                                {t.name || "—"}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                                {t.oldItemNo || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)]">{t.uom || "—"}</td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {num(t.totQty)}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-xs text-[var(--text-secondary)] text-right">
                                {num(t.qtyIn)}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap max-w-[140px] truncate">
                                {t.location || t.locationName || "—"}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-muted)] whitespace-nowrap max-w-[140px] truncate">
                                {t.locationOutputName || "—"}
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
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                {t.calibrationFrqMonths && t.calibrationFrqMonths > 0 ? (
                                  t.nextCalibDate ? (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.calibDueStatus === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : t.calibDueStatus === "due-soon" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${t.calibDueStatus === "overdue" ? "bg-red-500" : t.calibDueStatus === "due-soon" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                      {new Date(t.nextCalibDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                      Not Calibrated
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-[var(--text-muted)]">—</span>
                                )}
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
                                      onClick={() => handleOpenEdit(t)}
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
                            <td colSpan={19} className="py-8 text-center text-sm text-[var(--text-muted)]">
                              No tool records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loading && total > 0 && (
                  <div className="px-4 py-3 border-t border-[var(--border-main)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      if (selectedTool) handleOpenEdit(selectedTool);
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
                    <div className="md:col-span-2"><p className="text-[var(--text-muted)] font-semibold uppercase">Description</p><p className="font-medium text-sm text-[var(--text-primary)] mt-0.5">{description || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Tool Group</p><p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">{grouping || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Tool Type</p><p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">{type || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Item Name</p><p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">{name || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Item No / Tool Code</p><p className="font-mono font-bold text-sm text-[var(--text-primary)] mt-0.5">{toolOrGaugeNo}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Issue Type</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{issueType || "For Regular"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Asset Category</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{selectedTypeMeta?.assetCategory || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Addil. Remarks</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{remarks || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Ref Details</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{refDetails || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Old Item No</p><p className="font-mono text-[var(--text-primary)] mt-0.5">{oldItemNo || "—"}</p></div>
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
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stored Location</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{location || locationName || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Location Output</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{selectedTool?.locationOutputName || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Price</p><p className="font-mono font-bold text-[var(--text-primary)] mt-0.5">{price ? `₹${price}` : "0.00"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Issue By Customer</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{isCustGiven || "No"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">PO Required?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{poReq || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stock Required?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{stockReq || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Stock Item</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{stockItem || "Y"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Critical Item?</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{criticalItem || "No"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Returnable?</p><p className="font-semibold text-[var(--text-primary)] mt-0.5">{returnable || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Is Asset?</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{isAsset || "No"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Active Item?</p><p className="font-semibold text-emerald-600 mt-0.5">{activeItem || "Yes"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">HSN Code</p><p className="font-mono font-semibold text-[var(--text-primary)] mt-0.5">{hsnCode || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">NOC Required?</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{nocReq || "Yes"}</p></div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3 pb-1 border-b border-[var(--border-main)]">
                    Tools Details
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">No. of Cavity</p><p className="font-mono font-bold text-sm mt-0.5">{detailNoOfCavity || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Running Cavity</p><p className="font-mono font-bold text-sm mt-0.5">{detailRunningCavity || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Tool Life</p><p className="font-mono font-bold text-sm mt-0.5">{detailToolLife || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Balance Tool Life</p><p className="font-mono font-bold text-sm mt-0.5">{detailBalanceToolLife || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Hardness</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{detailHardness || "—"}</p></div>
                    <div><p className="text-[var(--text-muted)] font-semibold uppercase">Drawing No</p><p className="font-mono text-[var(--text-primary)] mt-0.5">{detailDrawingNo || "—"}</p></div>
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
                        <div><p className="text-[var(--text-muted)] font-semibold uppercase">Preventive MNT Done At</p><p className="font-medium text-[var(--text-primary)] mt-0.5">{preventiveFrqOthers || 0}</p></div>
                      </>
                    )}
                  </div>
                </div>
                )}
              </div>
              {/* ↑ closes Main Attributes Panel */}

              {/* Calibration Lifecycle Status Panel */}
              {showCalibrationTab && selectedTool?.calibrationSummary && (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                      Calibration Lifecycle Status
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Latest calibration activity from DC issue through results update</p>
                  </div>
                  {(selectedTool.calibrationSummary.resultStatus || selectedTool.calibrationSummary.calibStatus) && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      ["AVAILABLE FOR USE", "PASSED", "RECALIBRATED"].includes((selectedTool.calibrationSummary.resultStatus ?? "").toUpperCase())
                        ? "bg-emerald-100 text-emerald-700"
                        : ["FAILED", "REJECTED", "OUT OF SERVICE", "WORN OUT"].includes((selectedTool.calibrationSummary.resultStatus ?? "").toUpperCase())
                          ? "bg-red-100 text-red-700"
                          : selectedTool.calibrationSummary.calibStatus === "Not Started"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-100 text-amber-700"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        ["AVAILABLE FOR USE", "PASSED", "RECALIBRATED"].includes((selectedTool.calibrationSummary.resultStatus ?? "").toUpperCase())
                          ? "bg-emerald-500" : ["FAILED", "REJECTED", "OUT OF SERVICE", "WORN OUT"].includes((selectedTool.calibrationSummary.resultStatus ?? "").toUpperCase())
                            ? "bg-red-500" : selectedTool.calibrationSummary.calibStatus === "Not Started"
                              ? "bg-slate-400" : "bg-amber-500"
                      }`} />
                      {selectedTool.calibrationSummary.resultStatus || selectedTool.calibrationSummary.calibStatus || "Pending"}
                    </span>
                  )}
                </div>

                {selectedTool.calibrationSummary.calibStatus === "Not Started" && (
                  <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-600">
                    <span className="text-base">📋</span>
                    <span>This tool has not been issued for calibration yet. Expected first calibration due by <strong>
                      {new Date(selectedTool.calibrationSummary.nextCalibDate as unknown as string).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                    </strong>. Go to <Link href="/dashboard/calibration/issue" className="text-[var(--primary)] font-semibold hover:underline">Calibration → Issue</Link> to begin.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-[var(--bg-subtle)] rounded-xl p-3 border border-[var(--border-main)]">
                    <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Calibration DC No</p>
                    <p className="font-bold text-[var(--primary)] font-mono text-sm">
                      {selectedTool.calibrationSummary.dcNo ? `DC-${selectedTool.calibrationSummary.dcNo}` : "—"}
                    </p>
                    <p className="text-[var(--text-muted)] mt-0.5">
                      {selectedTool.calibrationSummary.issueDate
                        ? new Date(selectedTool.calibrationSummary.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : ""}
                    </p>
                  </div>

                  <div className="bg-[var(--bg-subtle)] rounded-xl p-3 border border-[var(--border-main)]">
                    <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Lab / Vendor</p>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{selectedTool.calibrationSummary.receiveName || "—"}</p>
                    <p className="text-[var(--text-muted)] mt-0.5">{selectedTool.calibrationSummary.issueFor || ""}</p>
                  </div>

                  <div className="bg-[var(--bg-subtle)] rounded-xl p-3 border border-[var(--border-main)]">
                    <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Certificate No</p>
                    <p className="font-bold text-[var(--text-primary)] font-mono text-sm">
                      {selectedTool.calibrationSummary.certificateNo || "—"}
                    </p>
                    <p className="text-[var(--text-muted)] mt-0.5">
                      {selectedTool.calibrationSummary.calibratedBy ? `By: ${selectedTool.calibrationSummary.calibratedBy}` : ""}
                    </p>
                  </div>

                  <div className="bg-[var(--bg-subtle)] rounded-xl p-3 border border-[var(--border-main)]">
                    <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Next Calib Due</p>
                    {selectedTool.calibrationSummary.nextCalibDate ? (
                      <>
                        <p className={`font-bold text-sm ${
                          new Date(selectedTool.calibrationSummary.nextCalibDate) < new Date() ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {new Date(selectedTool.calibrationSummary.nextCalibDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-[var(--text-muted)] mt-0.5">
                          {new Date(selectedTool.calibrationSummary.nextCalibDate) < new Date() ? "🔴 Overdue" : "🟢 On Schedule"}
                        </p>
                      </>
                    ) : (
                      <p className="font-semibold text-[var(--text-muted)] text-sm">Not Set</p>
                    )}
                  </div>
                </div>

                {selectedTool.calibrationSummary.calibratedDate && (
                  <div className="flex items-center gap-6 text-xs text-[var(--text-muted)] border-t border-[var(--border-main)] pt-3">
                    <span>Last Calibrated: <span className="font-semibold text-[var(--text-primary)]">
                      {new Date(selectedTool.calibrationSummary.calibratedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span></span>
                    {selectedTool.calibrationFrqMonths ? (
                      <span>Frequency: <span className="font-semibold text-[var(--text-primary)]">{selectedTool.calibrationFrqMonths} Months</span></span>
                    ) : null}
                    <Link href={`/dashboard/calibration/results-update`} className="ml-auto inline-flex items-center gap-1 text-[var(--primary)] font-semibold hover:underline">
                      <ExternalLink className="w-3 h-3" /> View Full History
                    </Link>
                  </div>
                )}
              </div>
              )}

              {/* Serial Numbers & Calibration History — always on view/edit */}
              {showSerialUnitsSection && (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      {calibBlockEnabled ? "Individual Serial Units & Calibration History" : "Individual Serial Units"}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      ERP unit grid from <span className="font-mono">GAUGE_SERIAL_NO</span> — same columns as Tools Manage Creation
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold bg-[var(--primary-light)] text-[var(--primary)] px-3 py-1 rounded-full">
                    {displayUnitRows.length} Serialized Units
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
                        <div className="flex items-center justify-between">
                          <FieldLabel>Purchase Dt</FieldLabel>
                          <button
                            type="button"
                            onClick={() => setUnitForm((f) => ({ ...f, purchaseDt: new Date().toISOString().split("T")[0] }))}
                            className="text-[10px] font-bold uppercase text-[var(--primary)] hover:underline mb-1 cursor-pointer"
                            disabled={viewState === "view"}
                          >
                            Set Today
                          </button>
                        </div>
                        <TextInput
                          type="date"
                          value={unitForm.purchaseDt}
                          onChange={(e) => setUnitForm((f) => ({ ...f, purchaseDt: e.target.value }))}
                          disabled={viewState === "view"}
                        />
                      </div>
                      <div>
                        <FieldLabel>Nxt Calib Dt (Auto)</FieldLabel>
                        <div className="h-9 px-3 flex items-center bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg text-xs font-mono font-semibold text-[var(--primary)]">
                          {(() => {
                            if (!calibrationFrqMonths || calibrationFrqMonths <= 0) return "—";
                            const pDt = unitForm.purchaseDt ? new Date(unitForm.purchaseDt) : new Date();
                            if (isNaN(pDt.getTime())) return "—";
                            pDt.setMonth(pDt.getMonth() + calibrationFrqMonths);
                            return formatDate(toIsoDateValue(pDt));
                          })()}
                        </div>
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
                          if (selectedTool) handleOpenEdit(selectedTool);
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

                <UnitHistoryTable
                  rows={displayUnitRows}
                  onUpdateUnitRow={handleUpdateUnitProp}
                  onUpdatePurchaseDt={handleUpdatePurchaseDt}
                  onCompletePm={
                    prevBlockEnabled
                      ? (refNo) => void handleCompletePreventive(refNo)
                      : undefined
                  }
                  emptyLabel={
                    serialNoGenReq
                      ? "Set Total Qty > 0 with Serial Gen = Yes to see unit rows."
                      : "No records found. Add a physical unit after the tool is saved."
                  }
                />
              </div>
              )}
            </div>
          ) : null}

          {(viewState === "create" || viewState === "edit") && (
            <OverlayModal
              open
              size="5xl"
              title={viewState === "create" ? "Add Tool" : "Edit Tool"}
              subtitle={
                viewState === "create"
                  ? undefined
                  : toolOrGaugeNo
                    ? `Editing ${toolOrGaugeNo}`
                    : undefined
              }
              onClose={() => attemptLeave("list")}
              footer={
                <div className="w-full flex flex-wrap items-center gap-1.5 justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={() => attemptLeave("list")}
                      title="Back to list"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    {viewState === "edit" && selectedTool ? (
                      <RoleGate permission="canDeleteMaster">
                        <button
                          type="button"
                          className={erpActionBtn}
                          onClick={async () => {
                            await handleDeleteTool(selectedTool.refNo);
                            executeLeave("list");
                          }}
                          title="Delete tool"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </RoleGate>
                    ) : null}
                    <span className="w-px h-5 bg-[var(--border-main)] mx-0.5 hidden sm:block" />
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={() => openDocSatellite("upload")}
                      title="Upload File"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload File
                    </button>
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={handlePrintToolForm}
                      title="Print"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={() => openDocSatellite("mandatory")}
                      title="Mandatory Documents"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> Mandatory Documents
                    </button>
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={() => jumpToErpSection("details")}
                      title="Tools Details"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Tools Details
                    </button>
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={() => jumpToErpSection("specs")}
                      title="Tools Specification"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Tools Specification
                    </button>
                    {showUnitHistoryTable && (
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={() => jumpToErpSection("units")}
                      title="ERP unit / serial table"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Unit Grid
                    </button>
                    )}
                    <button
                      type="button"
                      className={erpActionBtn}
                      onClick={handleClearForm}
                      title="Clear form"
                    >
                      <Eraser className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                  <button
                    type="submit"
                    form="tool-master-form"
                    id="tool-save-btn"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-bold bg-[var(--primary)] text-white hover:opacity-90"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              }
            >
              <form
                id="tool-master-form"
                onSubmit={handleSave}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between -mb-1 sticky top-0 z-20 bg-[var(--bg-card)] py-2 -mx-1 px-1 border-b border-[var(--border-main)]/60">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      type="search"
                      value={formFieldQuery}
                      onChange={(e) => setFormFieldQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (e.shiftKey) jumpFormFieldHit(-1);
                          else jumpFormFieldHit(1);
                        }
                        if (e.key === "Escape") {
                          setFormFieldQuery("");
                        }
                      }}
                      placeholder="Search fields (e.g. serial, price, calib)…"
                      className="w-full h-9 text-sm border border-[var(--border-main)] rounded-lg pl-8 pr-20 bg-[var(--bg-subtle)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)] placeholder:text-[var(--text-muted)]"
                      aria-label="Search form fields"
                    />
                    {formFieldQuery.trim() ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <span className="text-[10px] font-semibold tabular-nums text-[var(--text-muted)] mr-0.5">
                          {formFieldHitCount === 0
                            ? "0"
                            : `${formFieldActiveIdx + 1}/${formFieldHitCount}`}
                        </span>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] disabled:opacity-40"
                          disabled={formFieldHitCount === 0}
                          onClick={() => jumpFormFieldHit(-1)}
                          title="Previous match (Shift+Enter)"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] disabled:opacity-40"
                          disabled={formFieldHitCount === 0}
                          onClick={() => jumpFormFieldHit(1)}
                          title="Next match (Enter)"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                          onClick={() => setFormFieldQuery("")}
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={toggleAllFormSections}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline shrink-0 self-end sm:self-auto"
                  >
                    {allFormSectionsOpen ? "▲ Collapse All Sections" : "▼ Expand All Sections"}
                  </button>
                </div>
                {formFieldQuery.trim() && formFieldHitCount === 0 ? (
                  <p className="text-xs text-[var(--color-warning-text)] -mt-2">
                    No fields match “{formFieldQuery.trim()}”. Try another keyword.
                  </p>
                ) : null}
                <FormModalSection
                  id="tool-section-core"
                  title="Tool details"
                  collapsible
                  sticky
                  open={formSectionsOpen.core}
                  onOpenChange={(open) => setFormSectionOpen("core", open)}
                >
                    <div>
                      <FieldLabel>Description</FieldLabel>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] resize-none"
                        placeholder="Item description"
                      />
                    </div>
                    <div className="form-grid">
                      <div>
                        <FieldLabel>Tool Group *</FieldLabel>
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
                        {errors.grouping && <p className="form-error">{errors.grouping}</p>}
                      </div>
                      <div>
                        <FieldLabel>Tool Type{filteredTypes.length > 0 ? " *" : ""}</FieldLabel>
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
                        <FieldLabel>Asset Category</FieldLabel>
                        <TextInput
                          value={selectedTypeMeta?.assetCategory?.trim() || ""}
                          readOnly
                          placeholder="From Tool Type master"
                          className="bg-[var(--bg-subtle)]"
                        />
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          Comes from Tool Subgroup / Type (`ASSET_CATEGORY`) — edit on Masters → Tool Subgroup.
                        </p>
                      </div>
                      <div>
                        <FieldLabel>Tool Number *</FieldLabel>
                        <div className="flex gap-2 items-stretch">
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
                              className="h-10 shrink-0"
                              onClick={() => {
                                setToolNoLocked(false);
                                void suggestToolNumber();
                              }}
                            >
                              Next #
                            </Button>
                          )}
                        </div>
                        {errors.toolOrGaugeNo && <p className="form-error">{errors.toolOrGaugeNo}</p>}
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <FormLabel htmlFor="form-name" required className="!mb-0">
                            Tools Name
                          </FormLabel>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline"
                            onClick={() => {
                              if (!grouping.trim()) {
                                toastError("Select Tools Group first.");
                                return;
                              }
                              if (!type.trim()) {
                                toastError("Select Tools Type first.");
                                return;
                              }
                              if (!selectedGroupId || !selectedTypeId) {
                                toastError("Selected group/type could not be resolved from master data.");
                                return;
                              }
                              setNewToolName("");
                              setShowAddName(true);
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Name
                          </button>
                        </div>
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
                            No names for this group/type — use + Add Name (Tools Name for Type master).
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
                        <FieldLabel>Location Output Name</FieldLabel>
                        <p className="text-sm text-[var(--text-secondary)] py-2 font-mono">
                          {selectedTool?.locationOutputName ||
                            [locationName || location, area, rack].filter(Boolean).join(" / ") ||
                            "Derived on save from location + area + rack"}
                        </p>
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
                </FormModalSection>

                <FormModalSection
                  id="tool-section-stock"
                  title="Stock & flags"
                  collapsible
                  open={formSectionsOpen.stock}
                  onOpenChange={(open) => setFormSectionOpen("stock", open)}
                >
                    <div className="form-grid">
                      <div>
                        <FieldLabel>Total Qty</FieldLabel>
                        <NumInput
                          integer
                          min={0}
                          value={totQty}
                          onValueChange={(val) => {
                            setTotQty(val);
                            if (viewState === "create") setQtyIn(val);
                          }}
                          className="font-semibold"
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
                        <NumInput min={0} value={price} onValueChange={setPrice} />
                      </div>
                      <div>
                        <FieldLabel>ROL / Buffer Qty</FieldLabel>
                        <NumInput min={0} value={minOrderLevel} onValueChange={setMinOrderLevel} />
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
                        <FieldLabel>Stock Item</FieldLabel>
                        <SelectInput value={stockItem} onChange={(e) => setStockItem(e.target.value)}>
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </SelectInput>
                      </div>
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
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            Is Serial No Generation Required?
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            When Yes, creates{" "}
                            <span className="font-semibold text-[var(--text-primary)]">{Math.max(0, totQty)}</span>{" "}
                            unit row(s) in GAUGE_SERIAL_NO matching Total Qty (add/edit).
                          </p>
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
                            if (!toolOrGaugeNo.trim() || totQty <= 0) return;
                            setSerialPreview(
                              Array.from({ length: totQty }, (_, i) =>
                                `${toolOrGaugeNo} · S.No ${i + 1}`
                              )
                            );
                            setShowSerialPreview(true);
                          }}
                          className="text-xs font-bold text-[var(--primary)] hover:underline"
                        >
                          Preview Serial Numbers ({Math.max(0, totQty)}) →
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
                </FormModalSection>

                <div id="tool-section-details">
                <FormModalSection
                  id="tool-section-details-inner"
                  title="Tools Details"
                  collapsible
                  sticky
                  open={formSectionsOpen.details}
                  onOpenChange={(open) => setFormSectionOpen("details", open)}
                >
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    ERP <span className="font-semibold">Tools Details</span> satellite — cavity, life, hardness (`TOOLS_DETAILS`). Shrinkage omitted (not on ERP page).
                  </p>
                  <div className="form-grid">
                    <div>
                      <FieldLabel>No. of Cavity</FieldLabel>
                      <NumInput integer min={0} value={detailNoOfCavity} onValueChange={setDetailNoOfCavity} />
                    </div>
                    <div>
                      <FieldLabel>Running Cavity</FieldLabel>
                      <NumInput integer min={0} value={detailRunningCavity} onValueChange={setDetailRunningCavity} />
                    </div>
                    <div>
                      <FieldLabel>Tool Life</FieldLabel>
                      <NumInput integer min={0} value={detailToolLife} onValueChange={setDetailToolLife} />
                    </div>
                    <div>
                      <FieldLabel>Balance Tool Life</FieldLabel>
                      <NumInput integer min={0} value={detailBalanceToolLife} onValueChange={setDetailBalanceToolLife} />
                    </div>
                    <div>
                      <FieldLabel>Hardness</FieldLabel>
                      <TextInput
                        value={detailHardness}
                        onChange={(e) => setDetailHardness(e.target.value)}
                        maxLength={25}
                      />
                    </div>
                    <div>
                      <FieldLabel>Drawing No (Details)</FieldLabel>
                      <TextInput
                        value={detailDrawingNo}
                        onChange={(e) => setDetailDrawingNo(e.target.value)}
                        maxLength={30}
                      />
                    </div>
                  </div>
                </FormModalSection>
                </div>

                {showCalibrationTab && (
                <FormModalSection
                  id="tool-section-calibration"
                  title="Calibration"
                  collapsible
                  open={formSectionsOpen.calibration}
                  onOpenChange={(open) => setFormSectionOpen("calibration", open)}
                >
                    <div className="form-grid">
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
                        <NumInput integer min={0} value={calibrationFrqMonths} disabled={!calibBlockEnabled} onValueChange={setCalibrationFrqMonths} />
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
                          <NumInput step="0.001" value={gSpecUpperMin} disabled={!calibBlockEnabled} onValueChange={setGSpecUpperMin} />
                        </div>
                        <div>
                          <FieldLabel>Gauge Spec Upper Max</FieldLabel>
                          <NumInput step="0.001" value={gSpecUpperMax} disabled={!calibBlockEnabled} onValueChange={setGSpecUpperMax} />
                        </div>
                        <div>
                          <FieldLabel>Wear Limit Lower Max</FieldLabel>
                          <NumInput step="0.001" value={wLimitLowerMax} disabled={!calibBlockEnabled} onValueChange={setWLimitLowerMax} />
                        </div>
                        <div>
                          <FieldLabel>Wear Limit Upper Min</FieldLabel>
                          <NumInput step="0.001" value={wLimitUpperMin} disabled={!calibBlockEnabled} onValueChange={setWLimitUpperMin} />
                        </div>
                        <div>
                          <FieldLabel>Wear Limit Upper Max</FieldLabel>
                          <NumInput step="0.001" value={wLimitUpperMax} disabled={!calibBlockEnabled} onValueChange={setWLimitUpperMax} />
                        </div>
                        <div>
                          <FieldLabel>Product Spec Lower Max</FieldLabel>
                          <NumInput step="0.001" value={prodSpecLowerMax} disabled={!calibBlockEnabled} onValueChange={setProdSpecLowerMax} />
                        </div>
                        <div>
                          <FieldLabel>Product Spec Upper Min</FieldLabel>
                          <NumInput step="0.001" value={prodSpecUpperMin} disabled={!calibBlockEnabled} onValueChange={setProdSpecUpperMin} />
                        </div>
                        <div>
                          <FieldLabel>Product Spec Upper Max</FieldLabel>
                          <NumInput step="0.001" value={prodSpecUpperMax} disabled={!calibBlockEnabled} onValueChange={setProdSpecUpperMax} />
                        </div>
                      </div>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)]">
                          Gauge / wear / product specs are hidden for this tools type.
                        </p>
                      )}
                    </div>
                </FormModalSection>
                )}

                {showPreventiveTab && (
                <FormModalSection
                  id="tool-section-preventive"
                  title="Preventive MNT"
                  collapsible
                  open={formSectionsOpen.preventive}
                  onOpenChange={(open) => setFormSectionOpen("preventive", open)}
                >
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                      Controlled by <span className="font-semibold">Is Asset</span> on Stock &amp; Flags
                      {!prevBlockEnabled && " — set Is Asset to Yes to edit these fields"}
                      {". "}
                      Flow (no extra screens): save frequency → units get <span className="font-mono">Nxt PreMNT</span> →
                      on tool view click <span className="font-semibold">Complete PM</span> to advance next due.
                    </p>
                    <div className="form-grid">
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
                        <NumInput
                          integer
                          min={0}
                          value={preventiveFrqMonths}
                          disabled={!prevBlockEnabled}
                          onValueChange={setPreventiveFrqMonths}
                        />
                      </div>
                      <div>
                        <FieldLabel>Preventive MNT Done At</FieldLabel>
                        <NumInput
                          integer
                          min={0}
                          value={preventiveFrqOthers}
                          disabled={!prevBlockEnabled}
                          onValueChange={setPreventiveFrqOthers}
                        />
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          ERP field → <span className="font-mono">PREVENTIVE_FRQ_OTHERS</span>
                        </p>
                      </div>
                    </div>
                </FormModalSection>
                )}

                {showSpecsTab && (
                <div id="tool-section-specs">
                <FormModalSection
                  id="tool-section-specs-inner"
                  title="Tools Specification"
                  collapsible
                  open={formSectionsOpen.specs}
                  onOpenChange={(open) => setFormSectionOpen("specs", open)}
                >
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      ERP <span className="font-mono">TOOLS_SPECIFICATION</span> fields, grouped by detail
                      (not one wide table) — Parameter · Range · Wear Limit · Product Spec.
                    </p>

                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Parameters ({specs.filter((s) => s.parameter.trim()).length})
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setSpecs([...specs, emptyToolSpec(specs.length + 1)])
                        }
                        className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-4 h-4" /> Add Parameter
                      </button>
                    </div>

                    <div className="space-y-4 mb-5">
                      {specs.map((item, index) => {
                        const patchSpec = (partial: Partial<ToolSpec>) => {
                          const list = [...specs];
                          list[index] = { ...list[index], ...partial };
                          setSpecs(list);
                        };
                        return (
                          <div
                            key={index}
                            className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)]/40 p-4 space-y-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                                Parameter #{index + 1}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const list = specs.filter((_, i) => i !== index);
                                  setSpecs(list.length ? list : [emptyToolSpec(1)]);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--color-danger-text)]"
                                title="Remove parameter"
                              >
                                <Trash className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>

                            <div className="form-grid">
                              <div>
                                <FieldLabel>Seq</FieldLabel>
                                <NumInput
                                  integer
                                  min={1}
                                  value={item.sequence}
                                  onValueChange={(n) =>
                                    patchSpec({ sequence: n || index + 1 })
                                  }
                                />
                              </div>
                              <div>
                                <FieldLabel>Parameter</FieldLabel>
                                <TextInput
                                  value={item.parameter}
                                  placeholder="e.g. Diameter / Length"
                                  onChange={(e) => patchSpec({ parameter: e.target.value })}
                                />
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                                Gauge range
                              </p>
                              <div className="form-grid">
                                <div>
                                  <FieldLabel>Min</FieldLabel>
                                  <TextInput
                                    value={item.minRange}
                                    placeholder="Min"
                                    onChange={(e) => patchSpec({ minRange: e.target.value })}
                                    className="font-mono"
                                  />
                                </div>
                                <div>
                                  <FieldLabel>Max</FieldLabel>
                                  <TextInput
                                    value={item.maxRange}
                                    placeholder="Max"
                                    onChange={(e) => patchSpec({ maxRange: e.target.value })}
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                                Wear limit
                              </p>
                              <div className="form-grid">
                                <div>
                                  <FieldLabel>Wear Limit Min</FieldLabel>
                                  <TextInput
                                    value={item.wearLimitMin}
                                    placeholder="0.000"
                                    onChange={(e) => patchSpec({ wearLimitMin: e.target.value })}
                                    className="font-mono"
                                  />
                                </div>
                                <div>
                                  <FieldLabel>Wear Limit Max</FieldLabel>
                                  <TextInput
                                    value={item.wearLimitMax}
                                    placeholder="0.000"
                                    onChange={(e) => patchSpec({ wearLimitMax: e.target.value })}
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                                Product spec
                              </p>
                              <div className="form-grid">
                                <div>
                                  <FieldLabel>Product Spec Min</FieldLabel>
                                  <TextInput
                                    value={item.prodSpecMin}
                                    placeholder="0.000"
                                    onChange={(e) => patchSpec({ prodSpecMin: e.target.value })}
                                    className="font-mono"
                                  />
                                </div>
                                <div>
                                  <FieldLabel>Product Spec Max</FieldLabel>
                                  <TextInput
                                    value={item.prodSpecMax}
                                    placeholder="0.000"
                                    onChange={(e) => patchSpec({ prodSpecMax: e.target.value })}
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {specs.length === 0 && (
                        <p className="py-6 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-main)] rounded-xl">
                          No parameters yet — click Add Parameter.
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[var(--border-main)] pt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 font-semibold text-[var(--primary)] hover:underline"
                          onClick={() => {
                            if (!selectedTool?.refNo) {
                              toastError("Save the tool first, then Assign Machine.");
                              return;
                            }
                            void openMachineModal(selectedTool);
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Assign Machine
                        </button>
                        <Link
                          href={
                            toolOrGaugeNo.trim()
                              ? `/dashboard/masters/tool-mapping?tool=${encodeURIComponent(toolOrGaugeNo.trim())}`
                              : "/dashboard/masters/tool-mapping"
                          }
                          className="inline-flex items-center gap-1.5 font-semibold text-[var(--primary)] hover:underline"
                          onClick={(e) => {
                            if (!toolOrGaugeNo.trim()) {
                              e.preventDefault();
                              toastError("Enter Tool Number first for Tool Map To Product.");
                            }
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Tool Map To Product
                        </Link>
                      </div>
                      <div>
                        <FieldLabel>Detailed Spec</FieldLabel>
                        <textarea
                          rows={3}
                          value={detailedSpec}
                          onChange={(e) => setDetailedSpec(e.target.value)}
                          className="form-control outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] resize-none"
                          placeholder="Free-text technical description (GAUGEANDTOOLS.DETAILED_SPEC)"
                        />
                      </div>
                      <div className="form-grid">
                        <div>
                          <FieldLabel>Addil. Remarks</FieldLabel>
                          <TextInput
                            value={remarks}
                            maxLength={50}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Additional remarks"
                          />
                        </div>
                        <div>
                          <FieldLabel>Ref Details</FieldLabel>
                          <TextInput
                            value={refDetails}
                            maxLength={50}
                            onChange={(e) => setRefDetails(e.target.value)}
                            placeholder="ERP Ref Details"
                          />
                        </div>
                      </div>
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
                          <NumInput integer min={0} value={selfLife} onValueChange={setSelfLife} />
                        </div>
                      </div>
                    </div>
                </FormModalSection>
                </div>
                )}

                {showUnitHistoryTable && (
                <div id="tool-section-units">
                <FormModalSection
                  id="tool-section-units-inner"
                  title="Physical units (ERP unit grid)"
                  collapsible
                  open={formSectionsOpen.units}
                  onOpenChange={(open) => setFormSectionOpen("units", open)}
                  action={
                    <span className="text-xs font-semibold text-[var(--primary)] font-mono">
                      {displayUnitRows.length} units
                      {plannedUnitCount > 0 ? ` · ${plannedUnitCount} pending save` : ""}
                    </span>
                  }
                >
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      Same table as ERP Tools Manage Creation. With{" "}
                      <span className="font-semibold">Serial Gen = Yes</span>, rows match{" "}
                      <span className="font-semibold">Total Qty</span> ({Math.max(0, totQty)}).
                      Planned rows show before Save; Save writes them to{" "}
                      <span className="font-mono">GAUGE_SERIAL_NO</span>.
                    </p>

                    {viewState === "create" && serialNoGenReq && totQty > 0 ? (
                      <p className="text-xs text-[var(--text-muted)] mb-3">
                        Showing {totQty} planned unit row(s) for this Total Qty. Click{" "}
                        <span className="font-semibold">Save</span> to create them in the database.
                      </p>
                    ) : viewState === "create" ? (
                      <p className="text-xs text-[var(--text-muted)] mb-3">
                        Turn on Serial Gen and set Total Qty — Save creates matching unit rows.
                      </p>
                    ) : null}

                    <UnitHistoryTable
                      rows={displayUnitRows}
                      onUpdateUnitRow={handleUpdateUnitProp}
                      onUpdatePurchaseDt={handleUpdatePurchaseDt}
                      onCompletePm={
                        prevBlockEnabled && selectedTool?.refNo
                          ? (refNo) => void handleCompletePreventive(refNo)
                          : undefined
                      }
                      emptyLabel="No records found."
                    />
                </FormModalSection>
                </div>
                )}

                {/* footer actions live in OverlayModal */}
              </form>
            </OverlayModal>
          )}

          {showAddName && (
            <OverlayModal
              open
              layer="nested"
              size="md"
              title="Add Tools Name"
              subtitle="Tools Name for Type master — linked to the Group / Type on this form"
              onClose={() => {
                if (!savingToolName) setShowAddName(false);
              }}
              footer={
                <div className="flex items-center justify-end gap-2 w-full">
                  <button
                    type="button"
                    className="form-btn-cancel"
                    disabled={savingToolName}
                    onClick={() => setShowAddName(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="form-btn-save"
                    disabled={savingToolName}
                    onClick={() => void handleSaveNewToolName()}
                  >
                    {savingToolName ? "Saving…" : "Save Name"}
                  </button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Tools Group</FieldLabel>
                    <TextInput value={grouping} disabled />
                  </div>
                  <div>
                    <FieldLabel>Tools Type</FieldLabel>
                    <TextInput value={type} disabled />
                  </div>
                </div>
                <div>
                  <FieldLabel>Tools Name *</FieldLabel>
                  <TextInput
                    autoFocus
                    value={newToolName}
                    maxLength={100}
                    placeholder="Enter new name for this group / type"
                    onChange={(e) => setNewToolName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSaveNewToolName();
                      }
                    }}
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Creates a row in <span className="font-mono">TOOLS_TYPE</span> for the selected group and type,
                    then selects it here.
                  </p>
                </div>
              </div>
            </OverlayModal>
          )}

          {(satellite === "upload" || satellite === "mandatory") && (
            <OverlayModal
              open
              layer="nested"
              size="lg"
              title={satellite === "mandatory" ? "Mandatory Documents" : "Upload File"}
              subtitle={
                toolOrGaugeNo
                  ? `Tool ${toolOrGaugeNo}`
                  : "Enter a tool number on the master form first"
              }
              onClose={() => setSatellite(null)}
              footer={
                <button
                  type="button"
                  className="form-btn-cancel"
                  onClick={() => setSatellite(null)}
                >
                  Close
                </button>
              }
            >
              <ToolDocumentsPanel
                toolOrGaugeNo={toolOrGaugeNo.trim()}
                title={satellite === "mandatory" ? "Mandatory Documents" : "Upload File"}
                defaultDocType={satellite === "mandatory" ? "DRAWING" : "OTHER"}
                allowedTypes={
                  satellite === "mandatory"
                    ? ["DRAWING", "TOOL_MANUAL", "CALIB_CERTIFICATE", "OTHER"]
                    : undefined
                }
                uploadButtonLabel={
                  satellite === "mandatory" ? "Upload Mandatory Doc" : "Upload/Change File"
                }
                canUpload={Boolean(toolOrGaugeNo.trim())}
                variant="form"
              />
              {satellite === "mandatory" ? (
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                  ERP checklist docs for this tool. Prefer Drawing / Manual / Certificate types.
                </p>
              ) : null}
            </OverlayModal>
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

            <div className="p-5 space-y-5">
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
        <div className="fixed inset-0 z-[70] overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
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
