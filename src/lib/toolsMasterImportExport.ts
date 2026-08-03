import type { ReportColumn } from "@/lib/serverReportExport";

export type ImportTemplateKind = "basic" | "full" | "price";

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const BASIC_COLUMNS: ReportColumn[] = [
  { key: "GROUPING", label: "GROUPING" },
  { key: "TYPE", label: "TYPE" },
  { key: "TOOL_OR_GAUGE_NO", label: "TOOL_OR_GAUGE_NO" },
  { key: "NAME", label: "NAME" },
  { key: "DES", label: "DES" },
  { key: "TOT_QTY", label: "TOT_QTY" },
  { key: "LOCATION", label: "LOCATION" },
  { key: "STATUS", label: "STATUS" },
];

export const FULL_COLUMNS: ReportColumn[] = [
  ...BASIC_COLUMNS,
  { key: "SERIAL_NO", label: "SERIAL_NO" },
  { key: "MAKE", label: "MAKE" },
  { key: "NO_OF_CAVITY", label: "NO_OF_CAVITY" },
  { key: "TOOL_LIFE", label: "TOOL_LIFE" },
  { key: "HARDNESS", label: "HARDNESS" },
  { key: "DRAWING_NO", label: "DRAWING_NO" },
  { key: "CALIBRATION_FRQ_MONTHS", label: "CALIBRATION_FRQ_MONTHS" },
  { key: "HISTORY_CARD_REQ", label: "HISTORY_CARD_REQ" },
];

export const PRICE_COLUMNS: ReportColumn[] = [
  { key: "TOOL_OR_GAUGE_NO", label: "TOOL_OR_GAUGE_NO" },
  { key: "PRICE", label: "PRICE" },
];

/** Default export uses Full Details columns (richest of the 3 templates). */
export const TOOLS_MASTER_EXPORT_COLUMNS = FULL_COLUMNS;

export function columnsForTemplate(kind: ImportTemplateKind): ReportColumn[] {
  if (kind === "basic") return BASIC_COLUMNS;
  if (kind === "price") return PRICE_COLUMNS;
  return FULL_COLUMNS;
}

export function parseTemplateKind(raw: unknown): ImportTemplateKind | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "basic" || v === "basic_info" || v === "1") return "basic";
  if (v === "full" || v === "full_details" || v === "2") return "full";
  if (v === "price" || v === "price_update" || v === "3") return "price";
  return null;
}

export function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).trim();
}

export function normalizeHeaderKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, "_");
}

export function parseNumeric(
  header: string,
  raw: unknown,
  opts?: { integer?: boolean; min?: number; required?: boolean }
): { ok: true; value: number | null } | { ok: false; reason: string } {
  const text = cellStr(raw);
  if (text === "") {
    if (opts?.required) return { ok: false, reason: `${header} is required` };
    return { ok: true, value: null };
  }
  const n = Number(text);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: `${header} must be numeric (got '${text}')` };
  }
  if (opts?.integer && !Number.isInteger(n)) {
    return { ok: false, reason: `${header} must be an integer (got '${text}')` };
  }
  if (opts?.min != null && n < opts.min) {
    return { ok: false, reason: `${header} must be >= ${opts.min} (got '${text}')` };
  }
  return { ok: true, value: n };
}

export type BasicImportData = {
  grouping: string;
  type: string | null;
  toolOrGaugeNo: string;
  name: string;
  description: string | null;
  totQty: number | null;
  location: string | null;
  status: string | null;
};

export type FullImportData = BasicImportData & {
  serialNo: number | null;
  make: string | null;
  noOfCavity: number | null;
  toolLife: number | null;
  hardness: string | null;
  drawingNo: string | null;
  calibrationFrqMonths: number | null;
  historyCardReq: string | null;
};

export type PriceImportData = {
  toolOrGaugeNo: string;
  price: number;
};

function parseBasicFields(
  raw: Record<string, unknown>
): { ok: true; data: BasicImportData } | { ok: false; reason: string } {
  const toolOrGaugeNo = cellStr(raw.TOOL_OR_GAUGE_NO);
  if (!toolOrGaugeNo) {
    return { ok: false, reason: "TOOL_OR_GAUGE_NO is required and cannot be blank" };
  }
  if (toolOrGaugeNo.length > 25) {
    return { ok: false, reason: "TOOL_OR_GAUGE_NO exceeds 25 characters" };
  }
  const grouping = cellStr(raw.GROUPING);
  if (!grouping) {
    return { ok: false, reason: "GROUPING is required and cannot be blank" };
  }
  const name = cellStr(raw.NAME);
  if (!name) {
    return { ok: false, reason: "NAME is required and cannot be blank" };
  }
  // Accept TOTAL_QTY as alias for TOT_QTY
  const qtyRaw = raw.TOT_QTY !== undefined && cellStr(raw.TOT_QTY) !== "" ? raw.TOT_QTY : raw.TOTAL_QTY;
  const totQty = parseNumeric("TOT_QTY", qtyRaw, { min: 0 });
  if (!totQty.ok) return totQty;

  return {
    ok: true,
    data: {
      grouping,
      type: cellStr(raw.TYPE) || null,
      toolOrGaugeNo,
      name,
      description: cellStr(raw.DES) || null,
      totQty: totQty.value,
      location: cellStr(raw.LOCATION) || null,
      status: cellStr(raw.STATUS) || null,
    },
  };
}

export function parseBasicRow(
  raw: Record<string, unknown>
): { ok: true; data: BasicImportData } | { ok: false; reason: string } {
  return parseBasicFields(raw);
}

export function parseFullRow(
  raw: Record<string, unknown>
): { ok: true; data: FullImportData } | { ok: false; reason: string } {
  const basic = parseBasicFields(raw);
  if (!basic.ok) return basic;

  const serialNo = parseNumeric("SERIAL_NO", raw.SERIAL_NO, { integer: true, min: 0 });
  if (!serialNo.ok) return serialNo;

  const make = cellStr(raw.MAKE) || null;
  if (make && serialNo.value == null) {
    return { ok: false, reason: "MAKE is present but SERIAL_NO is blank — provide SERIAL_NO to upsert serial" };
  }

  const noOfCavity = parseNumeric("NO_OF_CAVITY", raw.NO_OF_CAVITY, { integer: true, min: 0 });
  if (!noOfCavity.ok) return noOfCavity;
  const toolLife = parseNumeric("TOOL_LIFE", raw.TOOL_LIFE, { integer: true, min: 0 });
  if (!toolLife.ok) return toolLife;
  const calib = parseNumeric("CALIBRATION_FRQ_MONTHS", raw.CALIBRATION_FRQ_MONTHS, {
    integer: true,
    min: 0,
  });
  if (!calib.ok) return calib;

  return {
    ok: true,
    data: {
      ...basic.data,
      serialNo: serialNo.value,
      make,
      noOfCavity: noOfCavity.value,
      toolLife: toolLife.value,
      hardness: cellStr(raw.HARDNESS) || null,
      drawingNo: cellStr(raw.DRAWING_NO) || null,
      calibrationFrqMonths: calib.value,
      historyCardReq: cellStr(raw.HISTORY_CARD_REQ) || null,
    },
  };
}

export function parsePriceRow(
  raw: Record<string, unknown>
): { ok: true; data: PriceImportData } | { ok: false; reason: string } {
  const toolOrGaugeNo = cellStr(raw.TOOL_OR_GAUGE_NO);
  if (!toolOrGaugeNo) {
    return { ok: false, reason: "TOOL_OR_GAUGE_NO is required and cannot be blank" };
  }
  const price = parseNumeric("PRICE", raw.PRICE, { required: true, min: 0 });
  if (!price.ok) return price;
  return { ok: true, data: { toolOrGaugeNo, price: price.value! } };
}

function joinPipe(values: Array<string | number | null | undefined>): string {
  const parts = values.map((v) => (v == null || v === "" ? "" : String(v)));
  if (parts.every((p) => p === "")) return "";
  return parts.join("|");
}

/** Map a tool record into Full Details export columns. */
export function mapToolToExportRow(tool: {
  toolOrGaugeNo: string | null;
  grouping: string;
  type: string | null;
  name: string | null;
  description: string | null;
  totQty: unknown;
  location: string | null;
  status: string | null;
  calibrationFrqMonths: number | null;
  historyCardReq: string | null;
  serialNumbers?: Array<{
    serialNo: number | null;
    make: string | null;
  }>;
  details?: Array<{
    noOfCavity: number | null;
    toolLife: number | null;
    hardness: string | null;
    drawingNo: string | null;
  }>;
}): Record<string, unknown> {
  const serials = tool.serialNumbers ?? [];
  const detail = tool.details?.[0];
  return {
    GROUPING: tool.grouping ?? "",
    TYPE: tool.type ?? "",
    TOOL_OR_GAUGE_NO: tool.toolOrGaugeNo ?? "",
    NAME: tool.name ?? "",
    DES: tool.description ?? "",
    TOT_QTY: tool.totQty != null ? Number(tool.totQty) : "",
    LOCATION: tool.location ?? "",
    STATUS: tool.status ?? "",
    SERIAL_NO: joinPipe(serials.map((s) => s.serialNo)),
    MAKE: joinPipe(serials.map((s) => s.make)),
    NO_OF_CAVITY: detail?.noOfCavity ?? "",
    TOOL_LIFE: detail?.toolLife ?? "",
    HARDNESS: detail?.hardness ?? "",
    DRAWING_NO: detail?.drawingNo ?? "",
    CALIBRATION_FRQ_MONTHS: tool.calibrationFrqMonths ?? "",
    HISTORY_CARD_REQ: tool.historyCardReq ?? "",
  };
}
