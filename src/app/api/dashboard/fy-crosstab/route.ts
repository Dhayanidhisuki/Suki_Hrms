/**
 * GET /api/dashboard/fy-crosstab?fy=2026&groupBy=department|unit|employee&exit=include
 *
 * Financial-year cross-tab behind the FY Summary dashboard: every measure
 * aggregated across the 12 months of one Indian financial year (April ->
 * March), grouped by department, by unit, or by employee.
 *
 * Employee grouping is its own query rather than extra columns on the default
 * one: it multiplies the row count by headcount, so a 2000-person company
 * would carry that cost on every load of the department view that nobody
 * asked for. It is fetched only when that view is selected.
 *
 * Two raw grouped queries rather than Prisma groupBy: attributing a payroll
 * line or a leave application to a department means joining through JobInfo,
 * which groupBy cannot traverse, and pulling per-employee rows into JS would
 * scale with headcount x months. Grouping in SQL keeps the result proportional
 * to (months x departments) instead.
 *
 * `fy=2026` means April 2026 -> March 2027, the convention the legacy ERP
 * screen uses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const UNASSIGNED = 'Unassigned';

/** Apr = index 0 … Mar = index 11. */
export const FY_MONTHS = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
  'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
];

/** Calendar (year, month) -> column index in the FY, or -1 if outside it. */
function fyIndex(fy: number, year: number, month: number): number {
  if (year === fy && month >= 4) return month - 4;
  if (year === fy + 1 && month <= 3) return month + 8;
  return -1;
}

interface PayrollDimRow {
  yr: number;
  mo: number;
  department: string | null;
  unit: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  employees: number;
  gross: number;
  ot: number;
  pf: number;
  esi: number;
}

interface LeaveDimRow {
  yr: number;
  mo: number;
  department: string | null;
  unit: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  applications: number;
}

/** One row of a cross-tab: a label plus 12 month cells. */
interface CrossTabRow {
  /** Whatever the grouping dimension is — department, unit or employee. */
  label: string;
  department: string;
  unit: string;
  employee: string;
  values: number[];
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const now = new Date();
  // Before April the "current" FY still started in the previous calendar year.
  const defaultFy = now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const fy = Number(request.nextUrl.searchParams.get('fy')) || defaultFy;

  // Leavers are excluded unless asked for, matching the legacy report's EXIT
  // slicer and the Salary dashboard. Opt-in rather than opt-out so a figure
  // quoted off this page always means "people currently employed".
  const includeLeavers = request.nextUrl.searchParams.get('exit') === 'include';
  const employeeFilter = includeLeavers
    ? Prisma.sql`e.[deletedAt] IS NULL`
    : Prisma.sql`e.[deletedAt] IS NULL AND e.[status] = 'active'`;

  const requested = request.nextUrl.searchParams.get('groupBy');
  const groupBy: 'department' | 'unit' | 'employee' =
    requested === 'unit' || requested === 'employee' ? requested : 'department';
  const byEmployee = groupBy === 'employee';

  const fyStart = new Date(Date.UTC(fy, 3, 1));
  const fyEnd = new Date(Date.UTC(fy + 1, 3, 1));

  const [payrollRows, leaveRows] = await Promise.all([
    byEmployee
    ? prisma.$queryRaw<PayrollDimRow[]>`
      SELECT
        r.[year] AS yr,
        r.[month] AS mo,
        d.[name] AS department,
        u.[name] AS unit,
        e.[employeeCode] AS employeeCode,
        LTRIM(RTRIM(e.[firstName] + ' ' + ISNULL(e.[lastName], ''))) AS employeeName,
        COUNT(*) AS employees,
        SUM(l.[grossEarnings]) AS gross,
        SUM(l.[otAmount]) AS ot,
        SUM(l.[pfEmployee]) AS pf,
        SUM(l.[esiEmployee]) AS esi
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
      LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
      LEFT JOIN [Unit] u ON u.[id] = j.[unitId]
      WHERE r.[companyId] = ${companyId}
        AND ${employeeFilter}
        AND (
          (r.[year] = ${fy} AND r.[month] >= 4)
          OR (r.[year] = ${fy + 1} AND r.[month] <= 3)
        )
      GROUP BY r.[year], r.[month], d.[name], u.[name], e.[employeeCode], e.[firstName], e.[lastName]
    `
    : prisma.$queryRaw<PayrollDimRow[]>`
      SELECT
        r.[year] AS yr,
        r.[month] AS mo,
        d.[name] AS department,
        u.[name] AS unit,
        COUNT(*) AS employees,
        SUM(l.[grossEarnings]) AS gross,
        SUM(l.[otAmount]) AS ot,
        SUM(l.[pfEmployee]) AS pf,
        SUM(l.[esiEmployee]) AS esi
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
      LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
      LEFT JOIN [Unit] u ON u.[id] = j.[unitId]
      WHERE r.[companyId] = ${companyId}
        AND ${employeeFilter}
        AND (
          (r.[year] = ${fy} AND r.[month] >= 4)
          OR (r.[year] = ${fy + 1} AND r.[month] <= 3)
        )
      GROUP BY r.[year], r.[month], d.[name], u.[name]
    `,
    byEmployee
    ? prisma.$queryRaw<LeaveDimRow[]>`
      SELECT
        DATEPART(year, a.[fromDate]) AS yr,
        DATEPART(month, a.[fromDate]) AS mo,
        d.[name] AS department,
        u.[name] AS unit,
        e.[employeeCode] AS employeeCode,
        LTRIM(RTRIM(e.[firstName] + ' ' + ISNULL(e.[lastName], ''))) AS employeeName,
        COUNT(*) AS applications
      FROM [LeaveApplication] a
      INNER JOIN [Employee] e ON e.[id] = a.[employeeId]
      LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
      LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
      LEFT JOIN [Unit] u ON u.[id] = j.[unitId]
      WHERE e.[companyId] = ${companyId}
        AND ${employeeFilter}
        AND a.[status] = 'approved'
        AND a.[fromDate] >= ${fyStart}
        AND a.[fromDate] < ${fyEnd}
      GROUP BY DATEPART(year, a.[fromDate]), DATEPART(month, a.[fromDate]), d.[name], u.[name], e.[employeeCode], e.[firstName], e.[lastName]
    `
    : prisma.$queryRaw<LeaveDimRow[]>`
      SELECT
        DATEPART(year, a.[fromDate]) AS yr,
        DATEPART(month, a.[fromDate]) AS mo,
        d.[name] AS department,
        u.[name] AS unit,
        COUNT(*) AS applications
      FROM [LeaveApplication] a
      INNER JOIN [Employee] e ON e.[id] = a.[employeeId]
      LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
      LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
      LEFT JOIN [Unit] u ON u.[id] = j.[unitId]
      WHERE e.[companyId] = ${companyId}
        AND ${employeeFilter}
        AND a.[status] = 'approved'
        AND a.[fromDate] >= ${fyStart}
        AND a.[fromDate] < ${fyEnd}
      GROUP BY DATEPART(year, a.[fromDate]), DATEPART(month, a.[fromDate]), d.[name], u.[name]
    `,
  ]);

  const departments = new Set<string>();
  const units = new Set<string>();

  /** measure -> "department|unit|employee" -> 12 month cells. */
  const acc = new Map<string, Map<string, number[]>>();
  const add = (
    measure: string,
    dept: string,
    unit: string,
    employee: string,
    idx: number,
    value: number
  ) => {
    let byKey = acc.get(measure);
    if (!byKey) { byKey = new Map(); acc.set(measure, byKey); }
    const key = `${dept}|${unit}|${employee}`;
    let cells = byKey.get(key);
    if (!cells) { cells = Array(12).fill(0); byKey.set(key, cells); }
    cells[idx] += value;
  };

  for (const row of payrollRows) {
    const idx = fyIndex(fy, Number(row.yr), Number(row.mo));
    if (idx < 0) continue;
    const dept = row.department ?? UNASSIGNED;
    const unit = row.unit ?? UNASSIGNED;
    const employee = row.employeeCode
      ? `${row.employeeCode} · ${row.employeeName ?? ''}`.trim()
      : '';
    departments.add(dept);
    units.add(unit);
    add('salary', dept, unit, employee, idx, Number(row.gross) || 0);
    add('employees', dept, unit, employee, idx, Number(row.employees) || 0);
    add('overtime', dept, unit, employee, idx, Number(row.ot) || 0);
    add('pf', dept, unit, employee, idx, Number(row.pf) || 0);
    add('esi', dept, unit, employee, idx, Number(row.esi) || 0);
  }

  for (const row of leaveRows) {
    const idx = fyIndex(fy, Number(row.yr), Number(row.mo));
    if (idx < 0) continue;
    const dept = row.department ?? UNASSIGNED;
    const unit = row.unit ?? UNASSIGNED;
    const employee = row.employeeCode
      ? `${row.employeeCode} · ${row.employeeName ?? ''}`.trim()
      : '';
    departments.add(dept);
    units.add(unit);
    add('leave', dept, unit, employee, idx, Number(row.applications) || 0);
  }

  const toRows = (measure: string): CrossTabRow[] =>
    Array.from(acc.get(measure)?.entries() ?? [])
      .map(([key, values]) => {
        const [department, unit, employee] = key.split('|');
        const label =
          groupBy === 'unit' ? unit : groupBy === 'employee' ? employee || UNASSIGNED : department;
        return { label, department, unit, employee, values };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

  // Average cost per employee. Derived per cell rather than by dividing the
  // month totals, so a department with no payroll that month reads 0 instead
  // of dividing by zero.
  const salaryRows = toRows('salary');
  const employeeRows = toRows('employees');
  const perEmployee: CrossTabRow[] = salaryRows.map((s) => {
    const headcount = employeeRows.find(
      (e) => e.department === s.department && e.unit === s.unit && e.employee === s.employee
    );
    return {
      ...s,
      values: s.values.map((v, i) => {
        const n = headcount?.values[i] ?? 0;
        return n > 0 ? Math.round(v / n) : 0;
      }),
    };
  });

  return NextResponse.json({
    fy,
    fyLabel: `${fy}-${fy + 1}`,
    groupBy,
    includeLeavers,
    months: FY_MONTHS,
    departments: Array.from(departments).sort(),
    units: Array.from(units).sort(),
    measures: {
      salary: salaryRows,
      employees: employeeRows,
      overtime: toRows('overtime'),
      leave: toRows('leave'),
      pf: toRows('pf'),
      esi: toRows('esi'),
      salaryPerEmployee: perEmployee,
    },
  });
}
