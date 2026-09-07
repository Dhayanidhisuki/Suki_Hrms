/**
 * GET /api/payroll/runs/[id] — one run + every employee's line (the
 *                               Payroll Run page's grid data source).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId: scope.companyId },
    include: {
      lines: {
        include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
        orderBy: { employeeId: 'asc' },
      },
    },
  });
  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(run);
}
