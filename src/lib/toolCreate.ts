/**
 * Strict create/edit normalization for GAUGEANDTOOLS.
 * Mirrors confirmed ERPDb_Manpro behaviour — strip legacy placeholders,
 * build derived location fields, and apply create defaults used by real rows.
 */

export const ERP_ISSUE_TYPES = [
  "For Regular",
  "For Asset",
  "For Product",
  "For Employee",
  "For Department",
  "For Trial",
] as const;

export const ERP_COMPANY_UNITS = ["Unit 1", "Unit 2", "Unit 3"] as const;

export const PLACEHOLDER_VALUES = new Set([
  "",
  "-select-",
  "- select -",
  "select",
  "n/a",
]);

/** Legacy UI saved dropdown placeholders as if they were real data. */
export function stripPlaceholder(
  value: string | null | undefined
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function yesNoOrUndefined(
  value: string | null | undefined
): "Yes" | "No" | undefined {
  const cleaned = stripPlaceholder(value);
  if (!cleaned) return undefined;
  const v = cleaned.toUpperCase();
  if (v === "Y" || v === "YES") return "Yes";
  if (v === "N" || v === "NO") return "No";
  return cleaned === "Yes" || cleaned === "No" ? cleaned : undefined;
}

/** ERP stores LOCATION_OUTPUT_NAME as e.g. "Unit-1 / " or "Unit-1 / AREA". */
export function buildLocationOutputName(
  locationName?: string | null,
  area?: string | null
): string | undefined {
  const loc = stripPlaceholder(locationName);
  if (!loc) return undefined;
  const a = stripPlaceholder(area);
  return a ? `${loc} / ${a}` : `${loc} / `;
}

/**
 * Resolve tool-number prefix:
 * - Prefer subgroup PREFIX_TOOLS_NO when present
 * - Else when PREFIX_BASED = Group (or empty), use group PREFIX_TOOLS_NO
 * - Else fall back to group prefix
 */
export function resolveToolNumberPrefix(opts: {
  groupPrefix?: string | null;
  typePrefix?: string | null;
  prefixBased?: string | null;
  isAutoGenCd?: string | null;
}): string | null {
  const typePrefix = stripPlaceholder(opts.typePrefix) ?? null;
  const groupPrefix = stripPlaceholder(opts.groupPrefix) ?? null;
  const based = (stripPlaceholder(opts.prefixBased) ?? "Group").toLowerCase();

  if (typePrefix) return typePrefix;
  if (based === "group" || based === "type") return groupPrefix;
  return groupPrefix ?? typePrefix;
}

/** Parse OTH_J00325 → { prefix: "OTH_J", seq: 325, width: 5 } */
export function parsePrefixedToolNo(toolNo: string): {
  prefix: string;
  seq: number;
  width: number;
} | null {
  const m = toolNo.trim().toUpperCase().match(/^([A-Z0-9_]+?)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], seq: Number(m[2]), width: m[2].length };
}

export function formatNextToolNo(prefix: string, nextSeq: number, width = 5): string {
  const clean = prefix.replace(/-+$/, "").toUpperCase();
  return `${clean}${String(nextSeq).padStart(width, "0")}`;
}

/** Defaults applied on create so new rows match typical ERP inserts. */
export function erpCreateDefaults() {
  return {
    issueType: "For Regular" as const,
    uom: "Nos",
    returnable: "No" as const,
    activeItem: "Yes" as const,
    criticalItem: "No" as const,
    poReq: "Yes" as const,
    stockReq: "Yes" as const,
    stockItem: "Y" as const,
    isAsset: "No" as const,
    saleableItem: "No" as const,
    nocReq: "Yes" as const,
    machineSoftware: "No" as const,
    ineligibleForItc: "No" as const,
    isCustGiven: "No" as const,
    historyCardReq: "No" as const,
    companyId: "All" as const,
    // GAUGEANDTOOLS.STATUS is not a lifecycle field in ERP — leave unset.
    status: null as string | null,
  };
}

export type NormalizedToolFields = {
  location?: string;
  locationName?: string;
  area?: string;
  rack?: string;
  deptName?: string;
  hsnCode?: string;
  stiffness?: string;
  locationOutputName?: string;
  issueType?: string;
  companyId?: string;
  range?: string;
  leastCount?: string;
  calibrationResponsibility?: string;
};

/** Strip placeholders + derive LOCATION_OUTPUT_NAME before write. */
export function normalizeLocationAndLookups(
  input: NormalizedToolFields
): NormalizedToolFields {
  const locationName = stripPlaceholder(input.locationName);
  const area = stripPlaceholder(input.area);
  const rack = stripPlaceholder(input.rack);
  const location = stripPlaceholder(input.location) ?? locationName;
  const deptName = stripPlaceholder(input.deptName);
  const hsnCode = stripPlaceholder(input.hsnCode);
  const stiffness = stripPlaceholder(input.stiffness);
  const issueType = stripPlaceholder(input.issueType);
  const companyId = stripPlaceholder(input.companyId);
  const range = stripPlaceholder(input.range);
  const leastCount = stripPlaceholder(input.leastCount);
  const calibrationResponsibility = stripPlaceholder(
    input.calibrationResponsibility
  );

  return {
    location,
    locationName,
    area,
    rack,
    deptName,
    hsnCode,
    stiffness,
    issueType,
    companyId,
    range,
    leastCount,
    calibrationResponsibility,
    locationOutputName: buildLocationOutputName(locationName, area),
  };
}
