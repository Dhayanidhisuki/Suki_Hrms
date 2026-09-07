/**
 * GET /api/payroll/arrears — list this company's SalaryArrear rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const data = await prisma.salaryArrear.findMany({
    where: { companyId: scope.companyId },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      salaryRevisionRequest: { select: { id: true, revisionType: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
}
