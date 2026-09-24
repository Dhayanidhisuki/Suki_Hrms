/**
 * POST /api/workforce/ot-request/[id]/reject  { rejectionReason }
 *
 * Same two-stage dispatch as approve/route.ts: which authorization check
 * applies depends on the record's current status. Rejecting at either stage
 * ends the request (status=rejected) — no DailyAttendance write ever
 * happens on a rejected request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { otRequestRejectSchema } from '@/lib/validations/workforce';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const parsed = otRequestRejectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const requestId = Number(id);
  const record = await prisma.oTRequest.findUnique({ where: { id: requestId } });
  if (!record) {
    return NextResponse.json({ error: 'OT request not found' }, { status: 404 });
  }

  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
      return NextResponse.json({ error: "Forbidden — only this employee's Reporting Manager can reject this stage" }, { status: 403 });
    }
    const updated = await prisma.oTRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        managerActionByUserId: userId,
        managerActionAt: new Date(),
        managerRejectionReason: parsed.data.rejectionReason,
      },
    });

    await notifyEssRequest({
      kind: 'OT',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId,
      period: formatPeriod(record.date),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/ot-request',
    });

    return NextResponse.json(updated);
  }

  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
    if (permErr) return permErr;
    const updated = await prisma.oTRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        hrActionByUserId: userId,
        hrActionAt: new Date(),
        hrRejectionReason: parsed.data.rejectionReason,
      },
    });

    await notifyEssRequest({
      kind: 'OT',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId,
      period: formatPeriod(record.date),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/ot-request',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `Request is already ${record.status} — nothing to reject` }, { status: 409 });
}
