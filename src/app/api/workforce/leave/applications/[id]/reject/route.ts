/**
 * POST /api/workforce/leave/applications/[id]/reject
 * Body: { rejectionReason }
 *
 * Two-stage rejection (Manager → HR):
 *   - pending_manager: only the employee's own Reporting Manager may reject.
 *     Stores managerRejectionReason, sets status to 'rejected'.
 *   - pending_hr: requires workforce.leave.approve. Stores rejectionReason,
 *     sets status to 'rejected'.
 *
 * Per BRD §14: "Rejection reason should be captured" and BRD §11:
 * "Rejected leave shall not reduce leave balance."
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { leaveRejectSchema } from '@/lib/validations/workforce';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const applicationId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: { companyId: scope.companyId, deletedAt: null } },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const parsed = leaveRejectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // ── Stage 1: Manager rejection ──────────────────────────────────────────
  if (application.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, application.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can reject this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: 'rejected',
        managerRejectionReason: parsed.data.rejectionReason,
      },
    });
    return NextResponse.json(updated);
  }

  // ── Stage 2: HR rejection ───────────────────────────────────────────────
  if (application.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
    if (permErr) return permErr;

    const updated = await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: { status: 'rejected', rejectionReason: parsed.data.rejectionReason },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Cannot reject a ${application.status} application` },
    { status: 409 }
  );
}
