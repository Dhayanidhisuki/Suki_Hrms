/**
 * POST /api/workforce/mispunch/[id]/approve
 *
 * One endpoint for both approval stages — which one applies is decided by
 * the record's current status, not by the caller:
 *   - status=pending_manager: caller must be the requester's own Reporting
 *     Manager (hierarchy check, not RBAC — see src/lib/reportingManager.ts).
 *     Advances to pending_hr. No DailyAttendance write yet.
 *   - status=pending_hr: caller must hold workforce.mispunch.approve.
 *     This is the ONLY step that touches DailyAttendance.
 *
 * What the HR stage writes (2026-09-25 rewrite — see
 * docs/TIME_OFFICE_FLOW_AUDIT_2026-09-25.md D1/D2):
 *   - The correction is MERGED with the recorded day: a request that only
 *     supplies the out time keeps the recorded in-punch, and vice versa.
 *     Before this, the missing side was written as null, the day fell to
 *     the hours-only branch of deriveStatusAndMinutes and became Absent
 *     with zero minutes — the opposite of what the employee asked for.
 *   - Still one-sided after the merge → MissingPunch with the punch that
 *     exists, never Absent.
 *   - The day's shift honours ShiftAssignmentOverride (approved shift
 *     changes), and early-out plus weekly-off / holiday-worked flags are
 *     written the same way the biometric paths write them.
 *   - source='manual' marks the day as a human decision so the device sync
 *     leaves it alone (isProtectedFromDeviceOverwrite).
 *   - Respects the attendance lock exactly like every other writer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { findLinkedLeaveDates, linkedLeaveMessage } from '@/lib/leave/leaveDays';

import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { resolveEmployeeShiftConfig, resolveDailyShiftWithOverride, deriveStatusAndMinutes, refreshMonthlySummary } from '@/lib/biometricConversion';
import { isWeeklyOffForEmployee, isHolidayOrYearlyLeave } from '@/lib/weeklyOff';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const mispunchId = Number(id);
  const record = await prisma.mispunchCorrection.findUnique({ where: { id: mispunchId } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
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

    const linked = await findLinkedLeaveDates(record.employeeId, [record.date], { allowHalf: true });
    if (linked.length > 0) return NextResponse.json({ error: linkedLeaveMessage(linked) }, { status: 409 });

    // Merge the correction with what the device recorded. Only the side the
    // employee asked to change is replaced.
    const existing = await prisma.dailyAttendance.findUnique({
      where: { employeeId_date: { employeeId: record.employeeId, date: record.date } },
    });
    const inTime = record.requestedInTime ?? existing?.inTime ?? null;
    const outTime = record.requestedOutTime ?? existing?.outTime ?? null;
    if (inTime && outTime && outTime.getTime() <= inTime.getTime()) {
      return NextResponse.json(
        {
          error: `The corrected out time (${outTime.toISOString().slice(11, 16)}) is not after the in time (${inTime.toISOString().slice(11, 16)}) for this day. Reject this request and ask for both times.`,
        },
        { status: 400 }
      );
    }

    const config = await resolveEmployeeShiftConfig(record.employeeId);
    const shift = await resolveDailyShiftWithOverride(record.employeeId, record.date, config);
    const derived = deriveStatusAndMinutes(null, inTime, outTime, shift, config.otThresholdMinutes, config.maxOtMinutesPerDay);

    // A lone punch is a mispunch, not an absence — same rule as the sync.
    const status = inTime && outTime ? derived.status : 'MissingPunch';
    const worked = Boolean(inTime || outTime) && status !== 'Absent';
    const isWeeklyOffWorked = worked && (await isWeeklyOffForEmployee(scope.companyId, record.employeeId, record.date));
    const isHolidayWorked = worked && (await isHolidayOrYearlyLeave(scope.companyId, record.date));

    await prisma.$transaction(async (tx) => {
      await upsertDailyAttendanceWithHistory(
        tx,
        record.employeeId,
        record.date,
        {
          status,
          inTime,
          outTime,
          workingMinutes: derived.workingMinutes,
          lateMinutes: derived.lateMinutes,
          earlyOutMinutes: derived.earlyOutMinutes,
          otMinutesCalculated: derived.otMinutes,
          shiftMasterId: shift.shiftMasterId,
          isWeeklyOffWorked,
          isHolidayWorked,
          source: 'manual',
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
      companyId: scope.companyId,
      kind: 'MISPUNCH',
      action: 'APPROVED',
      employeeId: record.employeeId,
      requestId: mispunchId,
      period: formatPeriod(record.date),
      reason: record.reason,
      linkPath: '/ess/mis-punch',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `Request is already ${record.status} — nothing to approve` }, { status: 409 });
}
