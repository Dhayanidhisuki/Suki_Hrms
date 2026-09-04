/**
 * GET /api/payroll/arrears/[id] — detail incl. month-wise SalaryArrearMonth
 *                                  rows (BRD §18's auditability ask).
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

  const record = await prisma.salaryArrear.findFirst({
    where: { id: Number(id), companyId: scope.companyId },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      months: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      appliedPayrollRun: { select: { id: true, year: true, month: true, status: true } },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(record);
}
