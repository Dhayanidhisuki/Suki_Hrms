/**
 * POST /api/workforce/my-leave/[id]/cancel
 *   The logged-in employee cancels one of their own leave applications —
 *   pending (either stage) or approved. The work is in
 *   src/lib/leave/cancel.ts, shared with the HR route: an approved leave's
 *   days are restored to what the evidence says (never a blanket LOP) and
 *   the balance still debited is refunded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { cancelLeaveApplication } from '@/lib/leave/cancel';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const { id } = await params;
  const applicationId = Number(id);

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employeeId: ownEmployeeId },
    include: { leaveMaster: { select: { code: true, isPaid: true } }, employee: { select: { companyId: true } } },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = await cancelLeaveApplication(application, application.employee.companyId, userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await notifyEssRequest({
    companyId: application.employee.companyId,
    kind: 'LEAVE',
    action: 'CANCELLED',
    employeeId: application.employeeId,
    requestId: applicationId,
    period: formatPeriod(application.fromDate, application.toDate),
    linkPath: '/ess/leave',
  });

  return NextResponse.json({ message: 'Leave application cancelled', ...result });
}
