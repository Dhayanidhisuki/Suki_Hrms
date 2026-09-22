/**
 * GET /api/reports/headcount?asOfDate=YYYY-MM-DD
 *
 * Employee headcount report — by department, employee type, designation,
 * gender, status. Supports CSV export via ?format=csv.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  // 'employee.view' — singular. The permission table has no 'employees.view',
  // so the plural spelling 403'd this report for every role.
  const permErr = await checkSpecificPermission(request, 'employee.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const asOfDate = searchParams.get('asOfDate');
  const format = searchParams.get('format');

  const where: Record<string, unknown> = {
    companyId: scope.companyId,
    deletedAt: null,
    isActive: true,
  };
  if (asOfDate) {
    const d = new Date(asOfDate);
    where.OR = [
      { exitDate: null },
      { exitDate: { gt: d } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true, employeeCode: true, firstName: true, lastName: true,
      personalDetails: { select: { gender: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          designation: { select: { name: true } },
          department: { select: { name: true } },
          employeeType: { select: { name: true } },
        },
      },
    },
  });

  // Aggregate by department.
  const byDept = new Map<string, number>();
  const byType = new Map<string, number>();
  const byDesignation = new Map<string, number>();
  const byGender = new Map<string, number>();

  for (const e of employees) {
    const job = e.jobInfos[0];
    const dept = job?.department?.name ?? 'Unknown';
    const type = job?.employeeType?.name ?? 'Unknown';
    const desig = job?.designation?.name ?? 'Unknown';
    const gender = e.personalDetails?.gender ?? 'Unknown';

    byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
    byType.set(type, (byType.get(type) ?? 0) + 1);
    byDesignation.set(desig, (byDesignation.get(desig) ?? 0) + 1);
    byGender.set(gender, (byGender.get(gender) ?? 0) + 1);
  }

  const report = {
    asOfDate: asOfDate ?? new Date().toISOString().split('T')[0],
    totalHeadcount: employees.length,
    byDepartment: Array.from(byDept.entries()).map(([dept, count]) => ({ department: dept, count })),
    byEmployeeType: Array.from(byType.entries()).map(([type, count]) => ({ employeeType: type, count })),
    byDesignation: Array.from(byDesignation.entries()).map(([desig, count]) => ({ designation: desig, count })),
    byGender: Array.from(byGender.entries()).map(([gender, count]) => ({ gender, count })),
  };

  if (format === 'csv') {
    const lines = [
      `Total Headcount,${employees.length}`,
      '',
      'By Department',
      ...Array.from(byDept.entries()).map(([dept, count]) => `"${dept}",${count}`),
      '',
      'By Employee Type',
      ...Array.from(byType.entries()).map(([type, count]) => `"${type}",${count}`),
      '',
      'By Gender',
      ...Array.from(byGender.entries()).map(([gender, count]) => `${gender},${count}`),
    ];
    return new NextResponse(lines.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="headcount.csv"' },
    });
  }

  return NextResponse.json(report);
}
