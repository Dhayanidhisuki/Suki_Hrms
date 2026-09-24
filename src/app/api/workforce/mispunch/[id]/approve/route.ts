/**
 * POST /api/workforce/mispunch/[id]/approve
 *
 * One endpoint for both approval stages — which one applies is decided by
 * the record's current status, not by the caller:
 *   - status=pending_manager: caller must be the requester's own Reporting
 *     Manager (hierarchy check, not RBAC — see src/lib/reportingManager.ts).
 *     Advances to pending_hr. No DailyAttendance write yet.
 *   - status=pending_hr: caller must hold workforce.mispunch.approve.
 *     This is the ONLY step that touches DailyAttendance — computed via the
 *     same shift-aware derivation the biometric sync path uses
 *     (resolveEmployeeShiftConfig/resolveDailyShift/deriveStatusAndMinutes),
 *     written through upsertDailyAttendanceWithHistory so any prior value
 *     is preserved in history, then MonthlyAttendanceSummary is refreshed.
 *     Respects the frozen-month guard exactly like every other attendance
 *     write in this app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { resolveEmployeeShiftConfig, resolveDailyShift, deriveStatusAndMinutes, refreshMonthlySummary } from '@/lib/biometricConversion';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const mispunchId = Number(id);
  const record = await prisma.mispunchCorrection.findUnique({ where: { id: mispunchId } });
  if (!record) {
    return NextResponse.json({ error: 'Mispunch correction request not found' }, { status: 404 });
  }

  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
      return NextResponse.json({ error: 'Forbidden — only this employee\'s Reporting Manager can approve this stage' }, { status: 403 });
    }

    const updated = await prisma.mispunchCorrection.update({
      where: { id: mispunchId },
      data: { status: 'pending_hr', managerActionByUserId: userId, managerActionAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.mispunch.approve');
    if (permErr) return permErr;

    const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
    if (freezeErr) return freezeErr;

    const config = await resolveEmployeeShiftConfig(record.employeeId);
    const shift = resolveDailyShift(config, record.date);
    const derived = deriveStatusAndMinutes(
      null,
      record.requestedInTime,
      record.requestedOutTime,
      shift,
      config.otThresholdMinutes,
      config.maxOtMinutesPerDay
    );

    await prisma.$transaction(async (tx) => {
      await upsertDailyAttendanceWithHistory(
        tx,
        record.employeeId,
        record.date,
        {
          status: derived.status,
          inTime: record.requestedInTime,
          outTime: record.requestedOutTime,
          workingMinutes: derived.workingMinutes,
          lateMinutes: derived.lateMinutes,
          otMinutesCalculated: derived.otMinutes,
          shiftMasterId: shift.shiftMasterId,
          remarks: `Mispunch correction #${record.id}: ${record.reason}`,
        },
        { userId, changedBySource: 'manual' }
      );

      await tx.mispunchCorrection.update({
        where: { id: mispunchId },
        data: { status: 'approved', hrActionByUserId: userId, hrActionAt: new Date() },
      });
    });

    await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);

    const updated = await prisma.mispunchCorrection.findUnique({ where: { id: mispunchId } });

    await notifyEssRequest({
      kind: 'MISPUNCH',
      action: 'APPROVED',
      employeeId: record.employeeId,
      requestId: mispunchId,
      period: formatPeriod(record.date),
      reason: record.reason,
      linkPath: '/ess/mispunch',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `Request is already ${record.status} — nothing to approve` }, { status: 409 });
}
