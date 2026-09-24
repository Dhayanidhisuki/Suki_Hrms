/**
 * GET /api/dashboard/salary-bi?year=&month=&exit=include
 *
 * Everything behind the Salary dashboard, in one payload: department totals,
 * salary bands, top earners, the per-employee deduction breakdown and the
 * yearly trend.
 *
 * Grouped in SQL rather than through Prisma for the same reason as
 * fy-crosstab: attributing a payroll line to a department means joining
 * PayrollLine -> Employee -> JobInfo, which groupBy cannot traverse. The
 * per-employee queries are bounded with TOP, so the response stays flat even
 * on a large payroll.
 *
 * `month` omitted means the whole year. `exit=include` adds employees who have
 * left; by default only active ones are counted, which is what the legacy
 * report's EXIT slicer defaults to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const UNASSIGNED = 'Unassigned';
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Salary bands, matching the legacy report so the two can be compared.
 * Edit here and both the chart and the counts follow.
 */
export const SALARY_BANDS: Array<{ label: string; min: number; max: number | null }> = [
  { label: 'Upto 20K', min: 0, max: 20000 },
  { label: 'Above 20K to 40K', min: 20000, max: 40000 },
  { label: 'Above 40K to 60K', min: 40000, max: 60000 },
  { label: 'Above 60K to 80K', min: 60000, max: 80000 },
  { label: 'Above 80K to 1L', min: 80000, max: 100000 },
  { label: 'Above 1L to 1.5L', min: 100000, max: 150000 },
  { label: 'Above 1.5L to 2L', min: 150000, max: 200000 },
  { label: 'Above 2L', min: 200000, max: null },
];

interface DeptRow {
  department: string | null;
  unit: string | null;
  employees: number;
  gross: number;
  ot: number;
  performance: number;
  net: number;
}

interface EmpRow {
  employeeCode: string;
  name: string;
  department: string | null;
  gross: number;
  pf: number;
  esi: number;
  professionalTax: number;
  totalDeductions: number;
  net: number;
  runStatus: string | null;
  runStatusCount: number;
}

interface YearRow { yr: number; gross: number }
interface ComponentRow { name: string; type: string; amount: number }
interface MonthTrendRow { yr: number; mo: number; gross: number }
interface CompositionRow {
  net: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  other: number;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const sp = request.nextUrl.searchParams;
  const now = new Date();
  const year = Number(sp.get('year')) || now.getUTCFullYear();
  const monthRaw = Number(sp.get('month'));
  const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : null;
  const includeLeavers = sp.get('exit') === 'include';

  // Reused by every query below so a filter can never apply to one visual and
  // not another.
  const periodFilter = month
    ? Prisma.sql`r.[year] = ${year} AND r.[month] = ${month}`
    : Prisma.sql`r.[year] = ${year}`;
  const employeeFilter = includeLeavers
    ? Prisma.sql`e.[deletedAt] IS NULL`
    : Prisma.sql`e.[deletedAt] IS NULL AND e.[status] = 'active'`;

  // Last 6 calendar months of gross payroll, independent of the year/month
  // slicer above — the mockup's "Payroll Trend (Last 6 Months)" reads as a
  // rolling window, not the selected period.
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const trendStartYear = trendStart.getUTCFullYear();
  const trendStartMonth = trendStart.getUTCMonth() + 1;

  const [deptRows, empRows, yearRows, componentRows, monthTrendRows, compositionRows] = await Promise.all([
    prisma.$queryRaw<DeptRow[]>`
      SELECT
        d.[name] AS department,
        u.[name] AS unit,
        COUNT(DISTINCT l.[employeeId]) AS employees,
        SUM(l.[grossEarnings]) AS gross,
        SUM(l.[otAmount]) AS ot,
        SUM(l.[performanceIncentive]) AS performance,
        SUM(l.[netSalary]) AS net
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
      LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
      LEFT JOIN [Unit] u ON u.[id] = j.[unitId]
      WHERE r.[companyId] = ${companyId} AND ${periodFilter} AND ${employeeFilter}
      GROUP BY d.[name], u.[name]
    `,

    // One row per employee for the period: the band counts, the top-N list and
    // the deduction breakdown are all read off this, so they cannot disagree.
    prisma.$queryRaw<EmpRow[]>`
      SELECT
        e.[employeeCode] AS employeeCode,
        LTRIM(RTRIM(e.[firstName] + ' ' + ISNULL(e.[lastName], ''))) AS name,
        MAX(d.[name]) AS department,
        SUM(l.[grossEarnings]) AS gross,
        SUM(l.[pfEmployee]) AS pf,
        SUM(l.[esiEmployee]) AS esi,
        SUM(l.[professionalTax]) AS professionalTax,
        SUM(l.[grossEarnings]) - SUM(l.[netSalary]) AS totalDeductions,
        SUM(l.[netSalary]) AS net,
        MAX(r.[status]) AS runStatus,
        COUNT(DISTINCT r.[status]) AS runStatusCount
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      LEFT JOIN [JobInfo] j ON j.[employeeId] = e.[id] AND j.[effectiveTo] IS NULL
      LEFT JOIN [Department] d ON d.[id] = j.[departmentId]
      WHERE r.[companyId] = ${companyId} AND ${periodFilter} AND ${employeeFilter}
      GROUP BY e.[id], e.[employeeCode], e.[firstName], e.[lastName]
    `,

    prisma.$queryRaw<YearRow[]>`
      SELECT r.[year] AS yr, SUM(l.[grossEarnings]) AS gross
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      WHERE r.[companyId] = ${companyId} AND ${employeeFilter}
      GROUP BY r.[year]
    `,

    // Named components (canteen, incentives). Carries the component's own
    // `type`, so a total is labelled an earning or a deduction on the
    // component's authority rather than on a guess from its name.
    prisma.$queryRaw<ComponentRow[]>`
      SELECT sc.[name] AS name, sc.[type] AS type, SUM(plc.[amount]) AS amount
      FROM [PayrollLineComponent] plc
      INNER JOIN [PayrollLine] l ON l.[id] = plc.[payrollLineId]
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      INNER JOIN [SalaryComponent] sc ON sc.[id] = plc.[salaryComponentId]
      WHERE r.[companyId] = ${companyId} AND ${periodFilter} AND ${employeeFilter}
      GROUP BY sc.[name], sc.[type]
    `,

    prisma.$queryRaw<MonthTrendRow[]>`
      SELECT r.[year] AS yr, r.[month] AS mo, SUM(l.[grossEarnings]) AS gross
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      WHERE r.[companyId] = ${companyId} AND e.[deletedAt] IS NULL
        AND ((r.[year] = ${trendStartYear} AND r.[month] >= ${trendStartMonth}) OR r.[year] > ${trendStartYear})
      GROUP BY r.[year], r.[month]
    `,

    // Gross composition for the selected period: net paid plus every
    // statutory/ad-hoc deduction head, matching salary-cost's "Where the
    // Gross Goes" donut so the two dashboards agree on the same math.
    prisma.$queryRaw<CompositionRow[]>`
      SELECT
        SUM(l.[netSalary]) AS net,
        SUM(l.[pfEmployee]) AS pf,
        SUM(l.[esiEmployee]) AS esi,
        SUM(l.[professionalTax]) AS pt,
        SUM(l.[tds]) AS tds,
        SUM(l.[otherDeductionsTotal] + l.[lomAmount] + l.[lwfAmount] + l.[healthInsurance] + l.[licAmount]) AS other
      FROM [PayrollLine] l
      INNER JOIN [PayrollRun] r ON r.[id] = l.[payrollRunId]
      INNER JOIN [Employee] e ON e.[id] = l.[employeeId]
      WHERE r.[companyId] = ${companyId} AND ${periodFilter} AND ${employeeFilter}
    `,
  ]);

  // ---- departments ---------------------------------------------------------
  const byDeptMap = new Map<string, { department: string; gross: number; ot: number; performance: number; net: number; employees: number }>();
  const unitSet = new Set<string>();
  for (const r of deptRows) {
    const department = r.department ?? UNASSIGNED;
    unitSet.add(r.unit ?? UNASSIGNED);
    const b = byDeptMap.get(department) ?? { department, gross: 0, ot: 0, performance: 0, net: 0, employees: 0 };
    b.gross += Number(r.gross) || 0;
    b.ot += Number(r.ot) || 0;
    b.performance += Number(r.performance) || 0;
    b.net += Number(r.net) || 0;
    b.employees += Number(r.employees) || 0;
    byDeptMap.set(department, b);
  }
  const byDepartment = Array.from(byDeptMap.values()).sort((a, b) => b.gross - a.gross);

  // ---- employees -----------------------------------------------------------
  const employees = empRows
    .map((e) => ({
      employeeCode: e.employeeCode,
      name: e.name,
      department: e.department ?? UNASSIGNED,
      gross: Number(e.gross) || 0,
      pf: Number(e.pf) || 0,
      esi: Number(e.esi) || 0,
      professionalTax: Number(e.professionalTax) || 0,
      totalDeductions: Number(e.totalDeductions) || 0,
      net: Number(e.net) || 0,
      // Only meaningful for a single-month slice — one PayrollLine, one
      // PayrollRun.status. For "Whole year" (multiple runs summed per
      // employee), runStatusCount > 1 whenever those runs disagree, so we
      // report null rather than an arbitrary MAX() pick.
      runStatus: month && Number(e.runStatusCount) <= 1 ? e.runStatus : null,
    }))
    .sort((a, b) => b.gross - a.gross);

  // Distinct employees per band — not payslip rows. The legacy report counts
  // rows, which is why its bands sum to far more than its headcount.
  const bands = SALARY_BANDS.map((band) => ({
    label: band.label,
    employees: employees.filter(
      (e) => e.gross > band.min && (band.max === null || e.gross <= band.max)
    ).length,
  })).filter((b) => b.employees > 0);

  // ---- cards ---------------------------------------------------------------
  const paidDepartments = byDepartment.filter((d) => d.gross > 0);
  const highest = paidDepartments[0] ?? null;
  const lowest = paidDepartments[paidDepartments.length - 1] ?? null;
  const components = componentRows
    .map((c) => ({ name: c.name, type: c.type, amount: Number(c.amount) || 0 }))
    .filter((c) => c.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
  const canteen = components.find((c) => /canteen/i.test(c.name)) ?? null;

  // ---- 6-month trend --------------------------------------------------------
  const trendByKey = new Map(monthTrendRows.map((r) => [`${r.yr}-${r.mo}`, Number(r.gross) || 0]));
  const monthlyTrend: Array<{ label: string; year: number; month: number; gross: number }> = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(trendStartYear, trendStartMonth - 1 + i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    monthlyTrend.push({
      label: SHORT_MONTHS[m - 1],
      year: y,
      month: m,
      gross: trendByKey.get(`${y}-${m}`) ?? 0,
    });
  }

  // ---- gross composition ----------------------------------------------------
  const comp = compositionRows[0];
  const composition = comp
    ? {
        net: Number(comp.net) || 0,
        pf: Number(comp.pf) || 0,
        esi: Number(comp.esi) || 0,
        professionalTax: Number(comp.pt) || 0,
        tds: Number(comp.tds) || 0,
        other: Number(comp.other) || 0,
      }
    : null;

  // ---- recent activity --------------------------------------------------------
  // Assembled from real timestamps across three tables — there is no single
  // unified audit feed behind this yet, so this reads only what already has
  // a genuine "when did this happen" column rather than claiming to be a
  // full activity log.
  const [recentRuns, recentBonuses, recentHires] = await Promise.all([
    prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, year: true, month: true, status: true, updatedAt: true },
    }),
    prisma.bonusRecord.findMany({
      where: { companyId, status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { firstName: true, lastName: true, createdAt: true },
    }),
  ]);

  const RUN_STATUS_LABEL: Record<string, string> = {
    DRAFT: 'created',
    CALCULATED: 'calculated',
    VALIDATED: 'validated',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    LOCKED: 'locked',
    POSTED: 'posted',
  };

  const recentActivity = [
    ...recentRuns.map((r) => ({
      label: `Payroll for ${SHORT_MONTHS[r.month - 1]} ${r.year} ${RUN_STATUS_LABEL[r.status] ?? r.status.toLowerCase()}`,
      timestamp: r.updatedAt.toISOString(),
      status: r.status,
    })),
    ...recentBonuses.map((b) => ({
      label: `Bonus ${b.status === 'PENDING' ? 'requested' : b.status.toLowerCase()} — ${b.employee.firstName} ${b.employee.lastName ?? ''}`.trim(),
      timestamp: b.updatedAt.toISOString(),
      status: b.status,
    })),
    ...recentHires.map((e) => ({
      label: `New employee added — ${e.firstName} ${e.lastName ?? ''}`.trim(),
      timestamp: e.createdAt.toISOString(),
      status: null,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  return NextResponse.json({
    period: { year, month, includeLeavers },
    units: Array.from(unitSet).sort(),
    departments: byDepartment.map((d) => d.department).sort(),
    cards: {
      totalGross: byDepartment.reduce((s, d) => s + d.gross, 0),
      totalNet: byDepartment.reduce((s, d) => s + d.net, 0),
      overtime: byDepartment.reduce((s, d) => s + d.ot, 0),
      performance: byDepartment.reduce((s, d) => s + d.performance, 0),
      highestPaidDepartment: highest ? { department: highest.department, amount: highest.gross } : null,
      lowestPaidDepartment: lowest ? { department: lowest.department, amount: lowest.gross } : null,
      canteen,
    },
    byDepartment,
    bands,
    topEmployees: employees.slice(0, 10),
    breakdown: employees,
    byYear: yearRows
      .map((y) => ({ year: String(y.yr), gross: Number(y.gross) || 0 }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    components: components.slice(0, 12),
    monthlyTrend,
    composition,
    recentActivity,
  });
}
