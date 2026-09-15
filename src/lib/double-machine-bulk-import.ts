/**
 * Double Machine Incentive Excel import — same client-side xlsx pattern as
 * pms-bulk-import.ts. The Sample workbook pre-fills employee identity
 * columns from Employee Master; HR fills Double Machine / Att.Bonus /
 * Shift Incentive / OT Weekly Inc / Employee R.
 */

import * as XLSX from 'xlsx';

export const DOUBLE_MACHINE_TEMPLATE_COLUMNS = [
  'S.No',
  'Employee Code',
  'Employee Name',
  'Department',
  'Designation',
  'Month',
  'Double Machine',
  'Att.Bonus',
  'Shift Incentive',
  'OT Weekly Inc',
  'Employee R',
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ''), v]));
  for (const key of keys) {
    const found = lower[key.toLowerCase().replace(/\s+/g, '')];
    if (found !== undefined && found !== '') return found;
  }
  return '';
}

export interface DoubleMachineTemplateRow {
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationName: string | null;
  month: number;
  doubleMachine: number;
  attendanceBonus: number;
  shiftIncentive: number;
  otWeeklyInc: number;
  employeeR: number;
}

export interface DoubleMachineImportRow {
  row: number;
  employeeCode: string;
  employeeName?: string;
  departmentName?: string;
  designationName?: string;
  month?: string;
  employeeId?: number;
  doubleMachine: number;
  attendanceBonus: number;
  shiftIncentive: number;
  otWeeklyInc: number;
  employeeR: number;
  error?: string;
}

export function buildDoubleMachineTemplateWorkbook(rows: DoubleMachineTemplateRow[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const data: unknown[][] = [[...DOUBLE_MACHINE_TEMPLATE_COLUMNS]];
  rows.forEach((r, i) => {
    data.push([
      i + 1,
      r.employeeCode,
      r.employeeName,
      r.departmentName ?? '',
      r.designationName ?? '',
      monthName(r.month),
      // Blank cells for unset amounts — a 0 means "not entered" and HR
      // should see an empty cell to fill, not a prefilled zero.
      r.doubleMachine || '',
      r.attendanceBonus || '',
      r.shiftIncentive || '',
      r.otWeeklyInc || '',
      r.employeeR || '',
    ]);
  });
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [
    { wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, 'Double Machine');
  return wb;
}

export async function parseDoubleMachineWorkbookRows(
  file: File,
  employees: Array<{
    employeeId: number;
    employeeCode: string;
    oldEmployeeCode: string | null;
    employeeName: string;
    department: { name: string } | null;
    designation: { name: string } | null;
  }>
): Promise<DoubleMachineImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const parsed: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const byCode = new Map<string, (typeof employees)[number]>();
  for (const e of employees) {
    byCode.set(e.employeeCode.trim().toLowerCase(), e);
    if (e.oldEmployeeCode) byCode.set(e.oldEmployeeCode.trim().toLowerCase(), e);
  }

  return parsed.map((r, i) => {
    const employeeCode = String(cell(r, 'Employee Code', 'Emp Code', 'Old Employee Code') ?? '').trim();
    const doubleMachine = num(cell(r, 'Double Machine'));
    const attendanceBonus = num(cell(r, 'Att.Bonus', 'Att Bonus', 'Attendance Bonus'));
    const shiftIncentive = num(cell(r, 'Shift Incentive'));
    const otWeeklyInc = num(cell(r, 'OT Weekly Inc', 'OT Weekly Incentive'));
    const employeeR = num(cell(r, 'Employee R', 'Employee Remarks'));
    const emp = byCode.get(employeeCode.toLowerCase());

    let error: string | undefined;
    if (!employeeCode) error = 'Employee Code is required';
    else if (!emp) error = `Employee code "${employeeCode}" not found`;
    else if ([doubleMachine, attendanceBonus, shiftIncentive, otWeeklyInc, employeeR].some((n) => Number.isNaN(n))) {
      error = 'Amounts must be numbers ≥ 0';
    }

    return {
      row: i + 2,
      employeeCode,
      employeeName: emp?.employeeName ?? String(cell(r, 'Employee Name') ?? ''),
      departmentName: emp?.department?.name ?? String(cell(r, 'Department') ?? ''),
      designationName: emp?.designation?.name ?? String(cell(r, 'Designation') ?? ''),
      month: String(cell(r, 'Month') ?? ''),
      employeeId: emp?.employeeId,
      doubleMachine: Number.isNaN(doubleMachine) ? 0 : doubleMachine,
      attendanceBonus: Number.isNaN(attendanceBonus) ? 0 : attendanceBonus,
      shiftIncentive: Number.isNaN(shiftIncentive) ? 0 : shiftIncentive,
      otWeeklyInc: Number.isNaN(otWeeklyInc) ? 0 : otWeeklyInc,
      employeeR: Number.isNaN(employeeR) ? 0 : employeeR,
      error,
    };
  });
}
