/**
 * GET /api/payroll/runs/[id]/lines/[lineId] — one employee's full itemized
 *                                              line (the payslip's data
 *                                              source).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id, lineId } = await params;

  const line = await prisma.payrollLine.findFirst({
    where: {
      id: parseInt(lineId),
      payrollRunId: parseInt(id),
      payrollRun: { companyId: scope.companyId },
    },
    include: {
      payrollRun: { select: { year: true, month: true, status: true } },
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      components: { include: { salaryComponent: { select: { code: true, name: true, type: true } } } },
    },
  });
  if (!line) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(line);
}
