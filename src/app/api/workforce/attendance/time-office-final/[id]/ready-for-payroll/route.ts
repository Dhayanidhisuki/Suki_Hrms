/**
 * POST /api/workforce/attendance/time-office-final/[id]/ready-for-payroll
 *
 * Marks a finalized/frozen MonthlyAttendanceSummary as READY_FOR_PAYROLL —
 * the formal handoff from Time Office to Payroll (BRD §7).
 *
 * Prerequisites:
 *   - status must be FINALIZED or FROZEN
 *   - status must not already be READY_FOR_PAYROLL
 *
 * Body: { remarks?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.finalize');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const summaryId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const body = await request.json().catch(() => ({}));
  const remarks = typeof body.remarks === 'string' ? body.remarks.slice(0, 500) : null;

  // Verify the summary belongs to a company-scoped employee.
  const summary = await prisma.monthlyAttendanceSummary.findFirst({
    where: { id: summaryId, employee: { companyId: scope.companyId, deletedAt: null } },
  });
  if (!summary) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });

  if (summary.status !== 'FINALIZED' && summary.status !== 'FROZEN' && summary.status !== 'READY_FOR_PAYROLL') {
    return NextResponse.json(
      { error: `Summary must be FINALIZED or FROZEN (current: ${summary.status})` },
      { status: 409 }
    );
  }
  if (summary.status === 'READY_FOR_PAYROLL') {
    return NextResponse.json(
      { error: 'Summary is already marked READY_FOR_PAYROLL' },
      { status: 409 }
    );
  }

  const updated = await prisma.monthlyAttendanceSummary.update({
    where: { id: summaryId },
    data: {
      status: 'READY_FOR_PAYROLL',
      readyForPayrollAt: new Date(),
      readyForPayrollByUserId: userId,
      readyForPayrollRemarks: remarks,
    },
  });

  return NextResponse.json(updated);
}
