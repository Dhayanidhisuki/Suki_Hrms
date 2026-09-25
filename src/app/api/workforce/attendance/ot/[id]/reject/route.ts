/**
 * POST /api/workforce/attendance/ot/[id]/reject  { rejectionReason }
 *
 * Same two-stage dispatch as approve/route.ts. Rejecting at either stage
 * ends it (otApprovalStatus='rejected') — otMinutesApproved stays null and
 * no Comp-Off is ever granted on a rejected day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

const bodySchema = z.object({ rejectionReason: z.string().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const attendanceId = Number(id);
  const record = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
  if (!record) {
    return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
  }

  // A rejection is still a decision on a pay input — locked month, no change.
  const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
  if (freezeErr) return freezeErr;

  if (record.otApprovalStatus === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
      return NextResponse.json({ error: "Forbidden — only this employee's Reporting Manager can reject this stage" }, { status: 403 });
    }
    const updated = await prisma.dailyAttendance.update({
      where: { id: attendanceId },
      data: { otApprovalStatus: 'rejected', otManagerActionByUserId: userId, otManagerActionAt: new Date(), otRejectionReason: parsed.data.rejectionReason },
    });
    await notifyEssRequest({
      kind: 'OT',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId: attendanceId,
      period: formatPeriod(record.date),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/ot-request',
    });

    return NextResponse.json(updated);
  }

  if (record.otApprovalStatus === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
    if (permErr) return permErr;
    const updated = await prisma.dailyAttendance.update({
      where: { id: attendanceId },
      data: { otApprovalStatus: 'rejected', otHrActionByUserId: userId, otHrActionAt: new Date(), otRejectionReason: parsed.data.rejectionReason },
    });
    await notifyEssRequest({
      kind: 'OT',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId: attendanceId,
      period: formatPeriod(record.date),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/ot-request',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `OT is already ${record.otApprovalStatus ?? 'not pending'} — nothing to reject` }, { status: 409 });
}
