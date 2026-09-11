import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkEmployeePermission } from '@/lib/rbac-employee';

/**
 * GET /api/workforce/benefits/overview
 * Returns KPI counts per benefit component and the employee list per benefit.
 */
export async function GET(request: NextRequest) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const benefits = await prisma.benefitRateByEmployeeType.findMany({
    where: { companyId: scope.companyId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      amount: true,
      employeeType: { select: { id: true, name: true } },
      employeeBenefits: {
        where: { employee: { deletedAt: null, isActive: true } },
        select: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              oldEmployeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = benefits.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    employeeType: b.employeeType?.name ?? 'All',
    amount: Number(b.amount),
    employeeCount: b.employeeBenefits.length,
    employees: b.employeeBenefits.map((eb) => ({
      id: eb.employee.id,
      employeeCode: eb.employee.employeeCode,
      oldEmployeeCode: eb.employee.oldEmployeeCode,
      name: `${eb.employee.firstName} ${eb.employee.lastName}`.trim(),
    })),
  }));

  const totalEmployees = await prisma.employee.count({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
  });

  return NextResponse.json({
    totalEmployees,
    totalBenefits: data.length,
    totalAssignments: data.reduce((sum, b) => sum + b.employeeCount, 0),
    benefits: data,
  });
}
