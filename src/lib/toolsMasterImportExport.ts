import type { ReportColumn } from "@/lib/serverReportExport";
import { normalizeCompanyUnit } from "@/lib/companyUnits";

// ─── Constants ─────────────────────────────────────────────────────────────

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * The single import template — "Master List of Equipments and calibration
 * monitoring" as sent by the client.  Header is on row 4 of the workbook.
 *
 * Column order matches the client's actual sheet.  Normalised header keys
 * (trim → uppercase → spaces to underscores) are shown as comments.
 */
export const MASTER_IMPORT_COLUMNS: ReportColumn[] = [
  // SL._NO          → ignored (reported as row number only, not stored)
  { key: "EQUIP_NO", label: "Equip No" },
  { key: "DESCRIPTION", label: "Description" },
  { key: "SIZE", label: "Size" },
  { key: "LEAST_COUNT", label: "Least count" },

  { key: "MAKE", label: "Make" },
  { key: "MFG_S.NO", label: "MFG S.No" },
  { key: "USED_LOCATION", label: "Used Location" },
  { key: "CAL._FREQ._(MTHS)", label: "Cal. Freq. (mths)" },
  { key: "CALIBRATION_DATE", label: "Calibration date" },
  { key: "NEXT_CALIBRATION_DUE", label: "Next Calibration Due" },
  // VALIDITY_(DAYS) — present in the client's sheet but IGNORED on import.
  // It is a point-in-time countdown (Next Calibration Due − sheet date), not
  // a fact about the tool. It is computed live wherever displayed.
  { key: "VALIDITY_(DAYS)", label: "Validity (days)" },
  { key: "STATUS", label: "Status" },
  { key: "OBSERVED_ERROR", label: "Observed Error" },
  { key: "CALIBRATION_AGENCY", label: "Calibration Agency" },
  { key: "REMARKS", label: "Remarks" },
];

// ─── Shared utilities ───────────────────────────────────────────────────────

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

/**
 * Parse a cell value as a Date.  Accepts:
 *   - JS Date objects (from xlsx cellDates:true)
 *   - ISO date strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss…)
 *   - Excel serial numbers (numeric, > 1)
 * Returns null when the cell is blank.
 */
export function parseDate(
  header: string,
  raw: unknown
): { ok: true; value: Date | null } | { ok: false; reason: string } {
  if (raw == null || cellStr(raw) === "") return { ok: true, value: null };
  if (raw instanceof Date) {
    if (!isSqlServerDate(raw)) {
      return { ok: false, reason: `${header} is outside SQL Server's valid range (1753-9999)` };
    }
    return { ok: true, value: raw };
  }
  if (typeof raw === "number" && raw > 1) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isSqlServerDate(d)) {
      return { ok: false, reason: `${header} serial is outside SQL Server's valid range (1753-9999)` };
    }
    return { ok: true, value: d };
  }
  const s = cellStr(raw);

  // Client workbooks commonly contain hand-typed separators such as
  // 15-07--2026, 24-2 2026, 3-12-202\5, or 2-42026. Normalize only patterns
  // whose intended day/month/year remains deterministic.
  const normalized = normalizeImportDateText(s);

  // Check for DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    if (
      !isNaN(d.getTime()) &&
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month &&
      d.getUTCDate() === day
    ) {
      if (!isSqlServerDate(d)) {
        return { ok: false, reason: `${header} is outside SQL Server's valid range (1753-9999)` };
      }
      return { ok: true, value: d };
    }
  }

  const d = new Date(s);
  if (!isSqlServerDate(d)) {
    return {
      ok: false,
      reason: isNaN(d.getTime())
        ? `${header} '${s}' is not a valid date`
        : `${header} '${s}' is outside SQL Server's valid range (1753-9999)`,
    };
  }
  return { ok: true, value: d };
}

function isSqlServerDate(date: Date): boolean {
  const time = date.getTime();
  return Number.isFinite(time) &&
    time >= Date.UTC(1753, 0, 1) &&
    date.getUTCFullYear() <= 9999;
}

function normalizeImportDateText(input: string): string {
  let cleaned = input
    .trim()
    // A slash/backslash accidentally typed inside a year: 202\5 -> 2025.
    .replace(/(\d{3})[\\/](\d)(?!\d)/g, "$1$2")
    // Any separator run between date components becomes one hyphen.
    .replace(/[^\d]+/g, "-")
    .replace(/^-|-$/g, "");

  let parts = cleaned.split("-");
  // Missing separator between month and a four-digit year: 2-42026.
  if (parts.length === 2 && parts[1].length >= 5) {
    const joined = parts[1];
    parts = [parts[0], joined.slice(0, -4), joined.slice(-4)];
  }

  if (parts.length === 3 && parts[2].length === 5) {
    const currentYear = new Date().getUTCFullYear();
    const candidates = [...parts[2]].map((_, index) =>
      Number(parts[2].slice(0, index) + parts[2].slice(index + 1))
    );
    const plausible = [...new Set(candidates)].filter(
      (year) => year >= 1990 && year <= currentYear + 50
    );
    if (plausible.length > 0) {
      plausible.sort((a, b) => Math.abs(a - currentYear) - Math.abs(b - currentYear));
      parts[2] = String(plausible[0]);
    }
  }

  cleaned = parts.join("-");
  return cleaned;
}

// ─── Master import row type ─────────────────────────────────────────────────

/**
 * Parsed, validated row from the client's "Master List of Equipments and
 * calibration monitoring" sheet.
 *
 * Master-level fields (description … remarks) are taken from the FIRST
 * occurrence of a given EQUIP_NO in the file; subsequent rows for the same
 * tool but different units only contribute their unit-specific fields.
 *
 * Unit-specific fields: usedUnit, calibDate, nextCalibDate,
 * observedError, calibAgency.
 */
export type MasterImportData = {
  // ── Required ──────────────────────────────────────────────────────────────
  equipNo: string;   // → GAUGEANDTOOLS.TOOL_OR_GAUGE_NO

  // ── Master-level (first-occurrence per equipNo) ───────────────────────────
  description: string | null;       // → GAUGEANDTOOLS.DES
  size: string | null;              // → GAUGEANDTOOLS.SIZE
  leastCount: string | null;        // → GAUGEANDTOOLS.LEAST_COUNT
  usedUnit: string | null;          // → GAUGEANDTOOLS.LOCATION_NAME (current unit)
  usedLocation: string | null;      // → GAUGEANDTOOLS.LOCATION
  calibrationFrqMonths: number | null; // → GAUGEANDTOOLS.CALIBRATION_FRQ_MONTHS
  status: string | null;            // → GAUGEANDTOOLS.STATUS
  remarks: string | null;           // → GAUGEANDTOOLS.REMARKS

  // ── Per-unit (every occurrence) ───────────────────────────────────────────
  make: string | null;              // → GAUGEANDTOOLS.MAKE
  mfgSerialNo: string | null;       // → TOOLS_UNIT_STOCK.MFG_SERIAL_NO
  calibDate: Date | null;           // → TOOLS_UNIT_STOCK.CALIB_DATE + GAUGE_CONTROL_CARD_TRANS
  nextCalibDate: Date | null;       // → TOOLS_UNIT_STOCK.NEXT_CALIB_DATE + GAUGE_CONTROL_CARD_TRANS
  observedError: string | null;     // → TOOLS_UNIT_STOCK.OBSERVED_ERROR
  calibAgency: string | null;       // → TOOLS_UNIT_STOCK.CALIB_AGENCY
};

// ─── Row parser ─────────────────────────────────────────────────────────────

/**
 * Parse one normalised row from the master import sheet.
 *
 * `raw` keys are already normalised (trim → uppercase → spaces → underscores)
 * by `normalizeHeaderKey()` before this function is called.
 *
 * The client's sheet uses "Equip No" → normalised to "EQUIP_NO".
 * "Cal. Freq. (mths)" → "CAL._FREQ._(MTHS)" (dots and brackets survive the
 * normalisation because only spaces are replaced).
 */
export function parseMasterRow(
  raw: Record<string, unknown>
): { ok: true; data: MasterImportData } | { ok: false; reason: string } {
  // ── Required: Equip No ───────────────────────────────────────────────────
  const equipNo = cellStr(raw["EQUIP_NO"]);
  if (!equipNo) {
    return { ok: false, reason: "Equip No is required and cannot be blank" };
  }
  if (equipNo.length > 25) {
    return { ok: false, reason: `Equip No '${equipNo}' exceeds 25 characters` };
  }


  // ── Numeric fields ───────────────────────────────────────────────────────
  const calibFrq = parseNumeric("Cal. Freq. (mths)", raw["CAL._FREQ._(MTHS)"], {
    integer: true,
    min: 0,
  });
  if (!calibFrq.ok) return calibFrq;

  // Validity (days) is intentionally NOT read — see MASTER_IMPORT_COLUMNS note.

  // ── Date fields ──────────────────────────────────────────────────────────
  const calibDate = parseDate("Calibration date", raw["CALIBRATION_DATE"]);
  if (!calibDate.ok) return calibDate;

  const nextCalibDate = parseDate("Next Calibration Due", raw["NEXT_CALIBRATION_DUE"]);
  if (!nextCalibDate.ok) return nextCalibDate;

  // ── String fields (all optional) ─────────────────────────────────────────
  const size = cellStr(raw["SIZE"]) || null;
  if (size && size.length > 25) {
    return { ok: false, reason: `Size '${size}' exceeds 25 characters` };
  }
  const rawUsedUnit = cellStr(raw["USED_UNIT"]);
  const usedUnit = normalizeCompanyUnit(rawUsedUnit);
  if (!usedUnit) {
    return {
      ok: false,
      reason: `Used Unit must be Unit 1, Unit 2, or Unit 3${rawUsedUnit ? ` (found '${rawUsedUnit}')` : ""}`,
    };
  }

  const limitedFields: Array<[string, string, number]> = [
    ["Description", cellStr(raw["DESCRIPTION"]), 500],
    ["Least count", cellStr(raw["LEAST_COUNT"]), 50],
    ["Used Unit", cellStr(raw["USED_UNIT"]), 100],
    ["Used Location", cellStr(raw["USED_LOCATION"]), 50],
    ["Status", cellStr(raw["STATUS"]), 25],
    ["Remarks", cellStr(raw["REMARKS"]), 50],
    ["Make", cellStr(raw["MAKE"]), 50],
    ["MFG S.No", cellStr(raw["MFG_S.NO"] ?? raw["MFG_S_NO"]), 100],
    ["Observed Error", cellStr(raw["OBSERVED_ERROR"]), 200],
    ["Calibration Agency", cellStr(raw["CALIBRATION_AGENCY"]), 100],
  ];
  for (const [label, value, max] of limitedFields) {
    if (value.length > max) {
      return {
        ok: false,
        reason: `${label} exceeds ${max} characters (found ${value.length})`,
      };
    }
  }

  return {
    ok: true,
    data: {
      equipNo,
      description: cellStr(raw["DESCRIPTION"]) || null,
      size,
      leastCount: cellStr(raw["LEAST_COUNT"]) || null,
      usedUnit,
      usedLocation: cellStr(raw["USED_LOCATION"]) || null,
      calibrationFrqMonths: calibFrq.value,
      status: cellStr(raw["STATUS"]) || null,
      remarks: cellStr(raw["REMARKS"]) || null,
      make: cellStr(raw["MAKE"]) || null,
      mfgSerialNo: cellStr(raw["MFG_S.NO"] ?? raw["MFG_S_NO"]) || null,
      calibDate: calibDate.value,
      nextCalibDate: nextCalibDate.value,
      observedError: cellStr(raw["OBSERVED_ERROR"]) || null,
      calibAgency: cellStr(raw["CALIBRATION_AGENCY"]) || null,
    },
  };
}
