/**
 * Bulk Excel import for Employees (Basic Details only — same fields the Add
 * Employee wizard collects, see employee-form-fields.ts / basicDetailsSchema
 * in validations/employee.ts). Two pieces:
 *
 *   buildTemplateWorkbook(masters) — an .xlsx with a fillable "Employees"
 *   sheet (name-based columns, not IDs — nobody memorizes department IDs)
 *   plus a read-only "Reference Lists" sheet listing every valid Company /
 *   Department / Designation / etc. name to copy from.
 *
 *   parseWorkbookRows(file, masters) — reads an uploaded workbook back,
 *   resolves each row's names to IDs against the same master lists (case-
 *   insensitively), and returns one EmployeeCreatePayload (ready to POST to
 *   /api/employees) or a row error per row. employeeCode is never part of
 *   the payload — the API always server-generates it.
 */

import * as XLSX from 'xlsx';
import type { OptionList, EmployeeRef } from '@/lib/employee-form-fields';

export interface BulkImportMasters {
  companies: OptionList;
  units: OptionList;
  departments: OptionList;
  subDepartments: OptionList;
  designations: OptionList;
  employeeTypes: OptionList;
  categories: OptionList;
  grades: OptionList;
  levels: OptionList;
  reportingManagers: EmployeeRef[];
}

export const TEMPLATE_COLUMNS = [
  'Device ID (Biometric)',
  'Title',
  'First Name',
  'Middle Name',
  'Last Name',
  'Company',
  'Unit / Branch',
  'Department',
  'Sub Department',
  'Designation',
  'Employee Type',
  'Category',
  'Subcategory',
  'Grade',
  'Level',
  'Status',
  'Join Date (YYYY-MM-DD)',
  'Probation Period (Months)',
  'Reporting Manager Employee Code',
  'Shift Assignment Type (GENERAL/ROTATIONAL)',
  'Production Line',
  'Additional Role',
  'Team Group',
] as const;

const EXAMPLE_ROW = [
  '105', 'Mr', 'Ravi', '', 'Kumar', 'KUN Aerospace Private Limited', 'Main Unit',
  'Production', '', 'Machine Operator', 'Permanent', 'Workmen', '', '', '',
  'active', '2025-01-15', '6', '', 'GENERAL', '', '', '',
];

function refSheetColumn(label: string, list: OptionList | EmployeeRef[], toLabel: (x: any) => string) {
  return [label, ...list.map(toLabel)];
}

export function buildTemplateWorkbook(masters: BulkImportMasters): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const employeesSheet = XLSX.utils.aoa_to_sheet([[...TEMPLATE_COLUMNS], EXAMPLE_ROW]);
  employeesSheet['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, employeesSheet, 'Employees');

  const columns = [
    refSheetColumn('Company', masters.companies, (o) => o.name),
    refSheetColumn('Unit / Branch', masters.units, (o) => o.name),
    refSheetColumn('Department', masters.departments, (o) => o.name),
    refSheetColumn('Sub Department', masters.subDepartments, (o) => o.name),
    refSheetColumn('Designation', masters.designations, (o) => o.name),
    refSheetColumn('Employee Type', masters.employeeTypes, (o) => o.name),
    refSheetColumn('Category', masters.categories, (o) => o.name),
    refSheetColumn('Grade', masters.grades, (o) => o.name),
    refSheetColumn('Level', masters.levels, (o) => o.name),
    refSheetColumn(
      'Reporting Manager (Employee Code)',
      masters.reportingManagers,
      (e: EmployeeRef) => `${e.oldEmployeeCode ?? e.employeeCode} — ${e.firstName} ${e.lastName}`
    ),
  ];
  const maxRows = Math.max(...columns.map((c) => c.length));
  const refRows: string[][] = [];
  for (let r = 0; r < maxRows; r++) {
    refRows.push(columns.map((c) => c[r] ?? ''));
  }
  const refSheet = XLSX.utils.aoa_to_sheet(refRows);
  refSheet['!cols'] = columns.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(wb, refSheet, 'Reference Lists');

  return wb;
}

export interface EmployeeCreatePayload {
  companyId: number;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  oldEmployeeCode?: string;
  status?: string;
  reportingManagerId?: number;
  departmentId: number;
  subDepartmentId?: number;
  designationId: number;
  employeeTypeId: number;
  categoryId?: number;
  subCategory?: string;
  gradeId?: number;
  levelId?: number;
  unitId?: number;
  productionLine?: string;
  additionalRole?: string;
  teamGroup?: string;
  joinDate: string;
  probationPeriodMonths?: number;
  shiftAssignmentType?: string;
}

export interface RowResult {
  row: number;
  employeeName: string;
  payload?: EmployeeCreatePayload;
  error?: string;
}

function byName(list: OptionList, name: string): number | undefined {
  const target = name.trim().toLowerCase();
  return list.find((o) => o.name.trim().toLowerCase() === target)?.id;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/** Excel may hand back a JS Date (if the cell was date-formatted) or a plain string. */
function toIsoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function parseWorkbookRows(file: File, masters: BulkImportMasters): Promise<RowResult[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const results: RowResult[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // header is row 1
    const get = (col: (typeof TEMPLATE_COLUMNS)[number]) => str(row[col]);

    const firstName = get('First Name');
    const lastName = get('Last Name');
    const employeeName = [firstName, lastName].filter(Boolean).join(' ') || `(row ${rowNum})`;

    if (!firstName || !lastName) {
      results.push({ row: rowNum, employeeName, error: 'First Name and Last Name are required' });
      return;
    }

    const companyId = byName(masters.companies, get('Company'));
    if (!companyId) {
      results.push({ row: rowNum, employeeName, error: `Company "${get('Company')}" not found` });
      return;
    }
    const departmentId = byName(masters.departments, get('Department'));
    if (!departmentId) {
      results.push({ row: rowNum, employeeName, error: `Department "${get('Department')}" not found` });
      return;
    }
    const designationId = byName(masters.designations, get('Designation'));
    if (!designationId) {
      results.push({ row: rowNum, employeeName, error: `Designation "${get('Designation')}" not found` });
      return;
    }
    const employeeTypeId = byName(masters.employeeTypes, get('Employee Type'));
    if (!employeeTypeId) {
      results.push({ row: rowNum, employeeName, error: `Employee Type "${get('Employee Type')}" not found` });
      return;
    }
    const joinDate = toIsoDate(row['Join Date (YYYY-MM-DD)']);
    if (!joinDate) {
      results.push({ row: rowNum, employeeName, error: 'Join Date is required (YYYY-MM-DD)' });
      return;
    }

    const subDepartmentName = get('Sub Department');
    const unitName = get('Unit / Branch');
    const categoryName = get('Category');
    const gradeName = get('Grade');
    const levelName = get('Level');
    const mgrCode = get('Reporting Manager Employee Code');
    const probation = get('Probation Period (Months)');

    const payload: EmployeeCreatePayload = {
      companyId,
      departmentId,
      designationId,
      employeeTypeId,
      firstName,
      lastName,
      joinDate,
      title: get('Title') || undefined,
      middleName: get('Middle Name') || undefined,
      oldEmployeeCode: get('Device ID (Biometric)') || undefined,
      status: get('Status') || 'active',
      subDepartmentId: subDepartmentName ? byName(masters.subDepartments, subDepartmentName) : undefined,
      unitId: unitName ? byName(masters.units, unitName) : undefined,
      categoryId: categoryName ? byName(masters.categories, categoryName) : undefined,
      subCategory: get('Subcategory') || undefined,
      gradeId: gradeName ? byName(masters.grades, gradeName) : undefined,
      levelId: levelName ? byName(masters.levels, levelName) : undefined,
      productionLine: get('Production Line') || undefined,
      additionalRole: get('Additional Role') || undefined,
      teamGroup: get('Team Group') || undefined,
      probationPeriodMonths: probation ? Number(probation) : undefined,
      shiftAssignmentType: get('Shift Assignment Type (GENERAL/ROTATIONAL)') || undefined,
      reportingManagerId: mgrCode
        ? masters.reportingManagers.find((e) => e.oldEmployeeCode === mgrCode || e.employeeCode === mgrCode)?.id
        : undefined,
    };

    results.push({ row: rowNum, employeeName, payload });
  });

  return results;
}
