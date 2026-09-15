/**
 * PMS Incentive Excel import — mirrors the employee bulk-upload pattern
 * (employee-bulk-import.ts): everything is parsed client-side with `xlsx`,
 * resolved against the currently-loaded employee rows, and each valid row is
 * POSTed to the existing /api/payroll/pms endpoint so role + percentage
 * validation stays server-side.
 *
 *   buildPmsTemplateWorkbook(rows) — pre-fills one row per employee with the
 *   details a Reporting Manager needs (employee code/name, department,
 *   reporting manager, period, company %) and leaves "Individual %" blank for
 *   the manager to fill. The "Company %" column is reference-only for
 *   managers — parsePmsWorkbookRows rejects edits to it unless
 *   allowCompanyOverride (HR/Admin) is set.
 *
 *   parsePmsWorkbookRows(file, employees, allowCompanyOverride) — reads the
 *   filled workbook back, skips fully-empty rows, resolves each row by
 *   Employee Code, and validates the percentages.
 */

import * as XLSX from 'xlsx';

export const PMS_TEMPLATE_COLUMNS = [
  'Employee Code',
  'Employee Name',
  'Department',
  'Reporting Manager',
  'Year',
  'Month',
  'Company %',
  'Individual %',
  'Remarks',
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface PmsTemplateRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  managerName: string | null;
  year: number;
  month: number;
  companyPercent: number;
  individualPercent?: number | null;
  remarks: string | null;
}

export interface PmsImportRow {
  row: number;
  employeeCode: string;
  employeeName?: string;
  employeeId?: number;
  individualPercent?: number;
  companyPercent?: number;
  remarks?: string;
  error?: string;
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

export function monthNumber(value: unknown): number | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(s.toLowerCase()));
  return idx >= 0 ? idx + 1 : null;
}

export function buildPmsTemplateWorkbook(rows: PmsTemplateRow[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const data: unknown[][] = [[...PMS_TEMPLATE_COLUMNS]];
  rows.forEach((r) => {
    data.push([
      r.employeeCode,
      r.employeeName,
      r.departmentName ?? '',
      r.managerName ?? '',
      r.year,
      monthName(r.month),
      r.companyPercent,
      r.individualPercent ?? '',
      r.remarks ?? '',
    ]);
  });
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 22 },
    { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, 'PMS Incentive');
  return wb;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function num(v: unknown): number | null {
  const s = str(v);
  if (s === '') return null;
  const n = Number(s.replace(/%$/, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Reads a cell trying a few common header spellings. */
function cell(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) {
    if (row[n] !== undefined) return row[n];
  }
  // tolerate stray spacing / case differences in headers
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((key) => key.trim().toLowerCase() === n.toLowerCase());
    if (k !== undefined) return row[k];
  }
  return undefined;
}

export async function parsePmsWorkbookRows(
  file: File,
  employees: {
    employeeId: number;
    employeeCode: string;
    employeeName: string;
    year: number;
    month: number;
    companyPercent: number;
    recordId?: number | null;
    status?: string;
  }[],
  allowCompanyOverride = false
): Promise<PmsImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const byCode = new Map(employees.map((e) => [e.employeeCode.trim().toLowerCase(), e]));
  const expectedPeriod = employees[0];
  const seenInFile = new Set<number>();

  const results: PmsImportRow[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2; // header is row 1
    const employeeCode = str(cell(r, 'Employee Code', 'Emp Code', 'Code', 'EmployeeCode'));
    const individual = num(cell(r, 'Individual %', 'Individual Percent', 'Individual', 'Individual % '));
    const company = num(cell(r, 'Company %', 'Company Percent', 'Company'));
    const remarks = str(cell(r, 'Remarks', 'Remark'));
    const fileYear = num(cell(r, 'Year'));
    const fileMonth = monthNumber(cell(r, 'Month'));

    // Skip fully-empty rows (trailing blank rows in the sheet)
    if (!employeeCode && individual === null && company === null && !remarks && fileYear === null && fileMonth === null) {
      return;
    }

    const result: PmsImportRow = { row: rowNum, employeeCode };

    const emp = byCode.get(employeeCode.toLowerCase());
    if (!emp) {
      result.error = employeeCode ? `Employee code "${employeeCode}" is not in this period's employee list` : 'Employee Code is required';
      results.push(result);
      return;
    }
    result.employeeId = emp.employeeId;
    result.employeeName = emp.employeeName;

    // Same employee + year + month may not be entered twice — either
    // duplicated inside the file or already submitted/processed in the DB
    // (draft/returned records stay updatable via import).
    if (seenInFile.has(emp.employeeId)) {
      result.error = 'Duplicate — employee appears more than once in this file';
      results.push(result);
      return;
    }
    seenInFile.add(emp.employeeId);

    if (emp.recordId != null && emp.status && !['draft', 'returned'].includes(emp.status)) {
      result.error = `Duplicate — a record already exists for this period (${emp.status})`;
      results.push(result);
      return;
    }

    if (expectedPeriod && fileYear !== null && fileMonth !== null && (fileYear !== expectedPeriod.year || fileMonth !== expectedPeriod.month)) {
      result.error = `Period must be ${monthName(expectedPeriod.month)} ${expectedPeriod.year}`;
      results.push(result);
      return;
    }

    if (individual === null || individual < 0 || individual > 50) {
      result.error = 'Individual % is required (0–50)';
      results.push(result);
      return;
    }
    result.individualPercent = individual;

    if (company !== null) {
      if (company < 0 || company > 50) {
        result.error = 'Company % cannot exceed 50';
        results.push(result);
        return;
      }
      if (!allowCompanyOverride && company !== emp.companyPercent) {
        result.error = 'Company % cannot be edited';
        results.push(result);
        return;
      }
      result.companyPercent = company;
    }

    if (remarks) result.remarks = remarks;

    results.push(result);
  });

  return results;
}
