/**
 * GET /api/employees/separations — this company's recorded separations
 * (ExitInterview rows), each flagged with its GratuityRecord (if any) so the
 * Exit Form and Gratuity pages can both list/filter off one source.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.separation.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const data = await prisma.exitInterview.findMany({
    where: { employee: { companyId: scope.companyId, deletedAt: null } },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      gratuityRecord: { select: { id: true, status: true } },
    },
    orderBy: { exitDate: 'desc' },
  });

  return NextResponse.json({ data });
}
