/**
 * GET /api/payroll/revisions/[id] — full detail incl. components + linked
 *                                    arrear (if any) + arrear month rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.salaryRevisionRequest.findFirst({
    where: { id: Number(id), companyId: scope.companyId },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      components: { include: { salaryComponent: { select: { name: true, code: true, type: true } } } },
      arrear: { include: { months: { orderBy: [{ year: 'asc' }, { month: 'asc' }] } } },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(record);
}
