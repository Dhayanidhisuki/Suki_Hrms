/**
 * POST /api/workforce/wfh/[id]/reject  { rejectionReason }
 *
 * Same two-stage dispatch as approve/route.ts: which authorization check
 * applies depends on the record's current status. Rejecting at either stage
 * ends the request (status=rejected) — no DailyAttendance write ever
 * happens on a rejected request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import { mispunchRejectSchema } from '@/lib/validations/workforce';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const parsed = mispunchRejectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const requestId = Number(id);
  const record = await prisma.wfhRequest.findUnique({ where: { id: requestId } });
  if (!record) {
    return NextResponse.json({ error: 'WFH request not found' }, { status: 404 });
  }

  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can reject this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.wfhRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        managerActionByUserId: userId,
        managerActionAt: new Date(),
        managerRejectionReason: parsed.data.rejectionReason,
      },
    });

    await notifyEssRequest({
      kind: 'WFH',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId: requestId,
      period: formatPeriod(record.fromDate, record.toDate),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/wfh',
    });

    return NextResponse.json(updated);
  }

  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.wfh.approve');
    if (permErr) return permErr;
    const updated = await prisma.wfhRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        approvedByUserId: userId,
        approvedAt: new Date(),
        rejectionReason: parsed.data.rejectionReason,
      },
    });

    await notifyEssRequest({
      kind: 'WFH',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId: requestId,
      period: formatPeriod(record.fromDate, record.toDate),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/wfh',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `Request is already ${record.status} — nothing to reject` }, { status: 409 });
}
