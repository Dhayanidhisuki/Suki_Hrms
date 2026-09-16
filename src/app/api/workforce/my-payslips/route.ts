/**
 * GET /api/workforce/my-payslips
 *   The logged-in employee's own payslips, newest first. Self-service:
 *   employeeId is resolved from the session, never taken from the client.
 *   Only shows runs that are APPROVED or LOCKED — a payslip is not final
 *   (and should not be shown to the employee) while payroll is still
 *   calculating, validating or awaiting approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

const PUBLISHED_STATUSES = ['APPROVED', 'LOCKED'];

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const lines = await prisma.payrollLine.findMany({
    where: {
      employeeId: ownEmployeeId,
      payrollRun: { companyId: scope.companyId, status: { in: PUBLISHED_STATUSES } },
    },
    select: {
      id: true,
      netSalary: true,
      status: true,
      payrollRun: { select: { id: true, year: true, month: true, status: true } },
    },
    orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }],
  });

  return NextResponse.json({ data: lines });
}
