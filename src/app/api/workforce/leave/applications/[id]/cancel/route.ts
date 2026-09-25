/**
 * POST /api/workforce/leave/applications/[id]/cancel
 *
 * HR cancels a leave application — pending (either stage) or approved. Per
 * BRD §11, "Cancelled leave shall restore the applicable balance". The work
 * is in src/lib/leave/cancel.ts, shared with the employee route: an
 * approved leave's days (linked by leaveApplicationId) are restored to what
 * the evidence says — punches, weekly off, holiday, else Absent — never a
 * blanket LOP, and the balance still debited is refunded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';
import { cancelLeaveApplication } from '@/lib/leave/cancel';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const applicationId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id')) || null;

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: { companyId: scope.companyId, deletedAt: null } },
    include: { leaveMaster: { select: { code: true, isPaid: true } } },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = await cancelLeaveApplication(application, scope.companyId, userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // After the transaction commits, never inside it: a notification must not
  // hold a database transaction open, nor be sent for work that rolled back.
  await notifyEssRequest({
    companyId: scope.companyId,
    kind: 'LEAVE',
    action: 'CANCELLED',
    employeeId: application.employeeId,
    requestId: applicationId,
    period: formatPeriod(application.fromDate, application.toDate),
    linkPath: '/ess/leave',
  });

  return NextResponse.json({ message: 'Leave application cancelled', ...result });
}
