/**
 * GET /api/employees/confirmation-pending — employees whose probation has
 * ended (probationEndDate <= today) but who haven't been confirmed yet
 * (confirmationDate is still null). Backs the Employees > Lifecycle >
 * Confirmation "Pending Confirmations" queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';

export async function GET(request: NextRequest) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      jobInfos: {
        some: {
          effectiveTo: null,
          confirmationDate: null,
          probationEndDate: { not: null, lte: new Date() },
        },
      },
    },
    include: {
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    data: employees.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      oldEmployeeCode: emp.oldEmployeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.jobInfos[0]?.department ?? null,
      designation: emp.jobInfos[0]?.designation ?? null,
      joinDate: emp.jobInfos[0]?.joinDate ?? null,
      probationEndDate: emp.jobInfos[0]?.probationEndDate ?? null,
    })),
  });
}
