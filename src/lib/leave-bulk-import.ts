/**
 * Bulk Leave Entry — template + workbook parsing for the Leave Entry page's
 * bulk upload. One sheet, one row per leave application.
 *
 * Only shape-level parsing lives here (columns, dates, numbers) so the
 * template builder and the row reader stay shared. Everything semantic —
 * employee lookup, leave type lookup, balance, overlap, frozen months —
 * needs the database and is done server-side by the bulk-upload route,
 * which runs it as a dry run first so HR sees every failing row before
 * anything is written.
 *
 * Status is decided per row by date, per the agreed rule: a leave starting
 * before the current calendar month is back-dated data entry and lands
 * `approved` (running the full approval side-effect chain); anything from
 * this month onward is a live request and lands `pending_manager` to go
 * through the normal Manager → HR stages.
 */

import * as XLSX from 'xlsx';

export const LEAVE_SHEET = 'Leave';
export const CODE_COL = 'Employee Code';

export const LEAVE_COLUMNS = [
  CODE_COL,
  'Leave Type Code',
  'From Date (YYYY-MM-DD)',
  'To Date (YYYY-MM-DD)',
  'Half Day (Yes/No)',
  'Number of Days (leave blank to calculate)',
  'Reason',
  'Contact During Leave',
  'Address During Leave',
] as const;

export type LeaveColumn = (typeof LEAVE_COLUMNS)[number];

const EXAMPLE_ROW = [
  'EMP001', 'CL', '2026-08-03', '2026-08-05', 'No', '', 'Family function', '9840000000', '',
];

/** One row as it came off the sheet, before any database lookup. */
export interface ParsedLeaveRow {
  /** 1-based row number in the sheet, as the user sees it in Excel. */
  row: number;
  employeeCode: string;
  leaveTypeCode: string;
  fromDate: string | null;
  toDate: string | null;
  isHalfDay: boolean;
  /** What the sheet said, if anything — null means "calculate it". */
  statedDays: number | null;
  reason: string | null;
  contactDuringLeave: string | null;
  addressDuringLeave: string | null;
  /** Shape-level problems: missing required cell, unparseable date, bad number. */
  errors: string[];
}

// ── cell helpers ────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function bool(v: unknown): boolean {
  const s = str(v).toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

function num(v: unknown): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Excel dates arrive as either a serial number or a string. Returns
 * YYYY-MM-DD, or null when the cell is empty or unparseable.
 */
export function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;

  if (typeof v === 'number') {
    // Excel serial → JS date (the 1899-12-30 epoch, UTC to avoid TZ drift).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }

  const s = str(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Accept DD/MM/YYYY and DD-MM-YYYY, the formats HR sheets actually use.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Inclusive day count between two YYYY-MM-DD dates. */
export function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * The status a row should land in, given the date it starts.
 * Back-dated (before this calendar month) → already-taken leave, approved.
 * This month onward → a live request, normal approval flow.
 */
export function statusForRow(fromDate: string, now = new Date()): 'approved' | 'pending_manager' {
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return Date.parse(`${fromDate}T00:00:00Z`) < monthStart ? 'approved' : 'pending_manager';
}

// ── template ────────────────────────────────────────────────────────────────

function sheetFrom(columns: readonly string[], example: string[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([columns as string[], example]);
  sheet['!cols'] = columns.map(() => ({ wch: 24 }));
  return sheet;
}

function buildReadMeSheet(): XLSX.WorkSheet {
  const rows: string[][] = [
    ['Bulk Leave Entry — how this works'],
    [],
    ['1.', 'Fill one row per leave application on the "Leave" sheet. Delete the example row.'],
    ['2.', 'Employee Code and Leave Type Code must match the "Reference Lists" sheet exactly.'],
    ['3.', 'Dates accept YYYY-MM-DD or DD/MM/YYYY.'],
    ['4.', 'Leave "Number of Days" blank and it is calculated from the date range (or 0.5 for a half day).'],
    ['5.', 'Upload the file, review the validation report, then import. Nothing is written until you import.'],
    [],
    ['Status rule'],
    ['', 'Leave starting BEFORE the current calendar month is treated as already-taken and is imported as APPROVED —'],
    ['', 'it deducts the leave balance and marks those days as Leave in attendance, exactly as approving it would.'],
    ['', 'Leave starting in the current month or later is imported as PENDING and goes through Manager then HR approval.'],
    [],
    ['Rows that will be rejected'],
    ['', 'Insufficient leave balance (checked across all rows in this file for the same employee, not just one at a time).'],
    ['', 'Overlapping another leave — in this file, or one already in the system.'],
    ['', 'A duplicate of a leave already in the system (same employee, type and dates).'],
    ['', 'Any date falling in a frozen attendance month — reopen the month first.'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 6 }, { wch: 116 }];
  return sheet;
}

export interface LeaveTypeRef {
  id: number;
  code: string;
  name: string;
}

export interface EmployeeCodeRef {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  lastName: string;
}

export function buildLeaveTemplateWorkbook(
  leaveTypes: LeaveTypeRef[],
  employees: EmployeeCodeRef[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildReadMeSheet(), 'Read Me First');
  XLSX.utils.book_append_sheet(wb, sheetFrom(LEAVE_COLUMNS, EXAMPLE_ROW), LEAVE_SHEET);

  const typeCol = ['Leave Type Code', ...leaveTypes.map((t) => `${t.code} — ${t.name}`)];
  const empCol = [
    'Employee Code',
    ...employees.map((e) => (e.oldEmployeeCode ? `${e.oldEmployeeCode} — ${e.firstName} ${e.lastName}` : `${e.firstName} ${e.lastName}`).trim()),
  ];
  const maxRows = Math.max(typeCol.length, empCol.length);
  const refRows: string[][] = [];
  for (let r = 0; r < maxRows; r++) refRows.push([typeCol[r] ?? '', empCol[r] ?? '']);
  const refSheet = XLSX.utils.aoa_to_sheet(refRows);
  refSheet['!cols'] = [{ wch: 34 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, refSheet, 'Reference Lists');

  return wb;
}

// ── parsing ─────────────────────────────────────────────────────────────────

export interface ParseResult {
  rows: ParsedLeaveRow[];
  /** Rows skipped entirely because every cell was blank. */
  blankRows: number;
}

export function parseLeaveWorkbook(buf: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[LEAVE_SHEET];
  if (!sheet) {
    throw new Error(`The workbook has no "${LEAVE_SHEET}" sheet — download the template and fill that sheet.`);
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows: ParsedLeaveRow[] = [];
  let blankRows = 0;

  raw.forEach((r, i) => {
    const employeeCode = str(r[CODE_COL]);
    const leaveTypeCode = str(r['Leave Type Code']);
    const fromRaw = r['From Date (YYYY-MM-DD)'];
    const toRaw = r['To Date (YYYY-MM-DD)'];

    const allBlank =
      !employeeCode && !leaveTypeCode && !str(fromRaw) && !str(toRaw) && !str(r['Reason']);
    if (allBlank) {
      blankRows++;
      return;
    }

    const errors: string[] = [];
    if (!employeeCode) errors.push('Employee Code is required');
    if (!leaveTypeCode) errors.push('Leave Type Code is required');

    const fromDate = toIsoDate(fromRaw);
    const toDate = toIsoDate(toRaw);
    if (!str(fromRaw)) errors.push('From Date is required');
    else if (!fromDate) errors.push('From Date is not a valid date');
    if (!str(toRaw)) errors.push('To Date is required');
    else if (!toDate) errors.push('To Date is not a valid date');
    if (fromDate && toDate && toDate < fromDate) errors.push('To Date cannot be before From Date');

    const statedRaw = str(r['Number of Days (leave blank to calculate)']);
    const stated = num(r['Number of Days (leave blank to calculate)']);
    if (statedRaw && stated === undefined) errors.push('Number of Days is not a number');
    if (stated !== undefined && stated <= 0) errors.push('Number of Days must be greater than zero');

    rows.push({
      // +2: one for the header row, one to make it 1-based like Excel's gutter.
      row: i + 2,
      employeeCode,
      leaveTypeCode,
      fromDate,
      toDate,
      isHalfDay: bool(r['Half Day (Yes/No)']),
      statedDays: stated ?? null,
      reason: str(r['Reason']) || null,
      contactDuringLeave: str(r['Contact During Leave']) || null,
      addressDuringLeave: str(r['Address During Leave']) || null,
      errors,
    });
  });

  return { rows, blankRows };
}
