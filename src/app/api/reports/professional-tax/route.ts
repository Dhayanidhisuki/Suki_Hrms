/**
 * GET /api/reports/professional-tax
 *   ?financialYear=2026&halfType=FINANCIAL&half=1&unitId=&employeeId=&status=active
 *
 * Read-only consolidated Professional Tax report (BRD:
 * KUN_HRMS___PT_BRD_.txt). No new calculation — aggregates PayrollLine rows
 * (grossEarnings/professionalTax/ptApplicable, already computed by
 * src/lib/payrollCalculation.ts) across the 6 months of the selected
 * half-year. A month with no processed PayrollRun (CALCULATED/APPROVED/
 * LOCKED) contributes zeros, not an error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { getHalfYearMonths, monthName, type HalfType } from '@/lib/financialYear';

function round(n: number) {
  return Math.round(n);
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const financialYear = Number(searchParams.get('financialYear'));
  const halfType = (searchParams.get('halfType') === 'NON_FINANCIAL' ? 'NON_FINANCIAL' : 'FINANCIAL') as HalfType;
  const half = searchParams.get('half') === '2' ? 2 : 1;
  const unitId = searchParams.get('unitId') ? Number(searchParams.get('unitId')) : undefined;
  const employeeId = searchParams.get('employeeId') ? Number(searchParams.get('employeeId')) : undefined;
  const status = searchParams.get('status') ?? 'active';

  if (!financialYear || Number.isNaN(financialYear)) {
    return NextResponse.json({ error: 'financialYear is required' }, { status: 400 });
  }

  const months = getHalfYearMonths(financialYear, halfType, half as 1 | 2);

  const [employees, runs, slabs] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId: scope.companyId,
        deletedAt: null,
        ...(status !== 'all' ? { status } : {}),
        ...(employeeId ? { id: employeeId } : {}),
        ...(unitId ? { jobInfos: { some: { effectiveTo: null, unitId } } } : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        jobInfos: { where: { effectiveTo: null }, take: 1, select: { unit: { select: { name: true } } } },
      },
      orderBy: { employeeCode: 'asc' },
    }),
    prisma.payrollRun.findMany({
      where: {
        companyId: scope.companyId,
        status: { in: ['CALCULATED', 'APPROVED', 'LOCKED'] },
        OR: months.map((m) => ({ year: m.year, month: m.month })),
      },
      include: { lines: { select: { employeeId: true, grossEarnings: true, professionalTax: true, ptApplicable: true } } },
    }),
    prisma.professionalTaxSlab.findMany({
      where: { effectiveTo: null, isActive: true },
      orderBy: { minSalary: 'asc' },
    }),
  ]);

  // year-month -> employeeId -> line
  const lineByMonthByEmployee = new Map<string, Map<number, (typeof runs)[number]['lines'][number]>>();
  for (const run of runs) {
    const key = `${run.year}-${run.month}`;
    const map = new Map(run.lines.map((l) => [l.employeeId, l]));
    lineByMonthByEmployee.set(key, map);
  }

  const employeeIds = new Set(employees.map((e) => e.id));

  const monthly = months.map((m, idx) => {
    const map = lineByMonthByEmployee.get(`${m.year}-${m.month}`);
    let totalEmployees = 0;
    let taxableEmployees = 0;
    let grossSalary = 0;
    let ptAmount = 0;
    if (map) {
      for (const [empId, line] of map) {
        if (!employeeIds.has(empId)) continue;
        totalEmployees++;
        grossSalary += Number(line.grossEarnings);
        if (line.ptApplicable && Number(line.professionalTax) > 0) {
          taxableEmployees++;
          ptAmount += Number(line.professionalTax);
        }
      }
    }
    return {
      sNo: idx + 1,
      year: m.year,
      month: m.month,
      monthLabel: monthName(m.month),
      totalEmployees,
      taxableEmployees,
      grossSalary: round(grossSalary),
      ptAmount: round(ptAmount),
    };
  });

  let cumulative = 0;
  const monthlyWithCumulative = monthly.map((row) => {
    cumulative += row.ptAmount;
    return { ...row, cumulativePT: cumulative };
  });

  const employeesDetail = employees.map((e) => {
    const monthsData = months.map((m) => {
      const line = lineByMonthByEmployee.get(`${m.year}-${m.month}`)?.get(e.id);
      return {
        year: m.year,
        month: m.month,
        monthLabel: monthName(m.month),
        grossEarnings: line ? round(Number(line.grossEarnings)) : 0,
        professionalTax: line && line.ptApplicable ? round(Number(line.professionalTax)) : 0,
      };
    });
    const totalGross = monthsData.reduce((s, m) => s + m.grossEarnings, 0);
    const totalPT = monthsData.reduce((s, m) => s + m.professionalTax, 0);
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      name: `${e.firstName} ${e.lastName}`.trim(),
      unit: e.jobInfos[0]?.unit?.name ?? null,
      months: monthsData,
      totalGross,
      totalPT,
    };
  });

  const summary = {
    totalEmployees: employees.length,
    taxableEmployees: employeesDetail.filter((e) => e.totalPT > 0).length,
    totalGrossSalary: employeesDetail.reduce((s, e) => s + e.totalGross, 0),
    totalPT: employeesDetail.reduce((s, e) => s + e.totalPT, 0),
  };

  const slabsDetail = slabs.map((s) => ({
    id: s.id,
    minSalary: Number(s.minSalary),
    maxSalary: s.maxSalary === null ? null : Number(s.maxSalary),
    monthlyPT: Number(s.monthlyAmount),
    halfYearlyPT: round(Number(s.monthlyAmount) * 6),
  }));

  return NextResponse.json({
    financialYear,
    halfType,
    half,
    months: months.map((m) => ({ year: m.year, month: m.month, label: monthName(m.month) })),
    summary,
    monthly: monthlyWithCumulative,
    slabs: slabsDetail,
    employees: employeesDetail,
  });
}
