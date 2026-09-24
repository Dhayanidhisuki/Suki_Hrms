/**
 * POST /api/workforce/ot-request/[id]/approve
 *
 * Two-stage approval (Manager → HR), same shape as Mis-Punch:
 *   Stage 1 (pending_manager): only the employee's own Reporting Manager
 *     may act. Advances to pending_hr. No DailyAttendance write yet.
 *   Stage 2 (pending_hr): requires workforce.ot.approve — the same grant
 *     that already gates the biometric-flagged OT queue, since both paths
 *     end up crediting the same DailyAttendance OT fields. Writes via
 *     upsertDailyAttendanceWithHistory, touching only otMinutesCalculated/
 *     otMinutesApproved/otApprovalStatus — the day's own status, in/out
 *     times, and everything else on that row are left exactly as they are.
 *     Refuses if the employee's current JobInfo has overtimeAllowed=false,
 *     the same eligibility rule the biometric OT auto-queue already applies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { isWeeklyOffForEmployee, isHolidayOrYearlyLeave } from '@/lib/weeklyOff';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const requestId = Number(id);
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const record = await prisma.oTRequest.findUnique({ where: { id: requestId } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'OT request not found' }, { status: 404 });
  }

  // ── Stage 1: Manager approval ──────────────────────────────────────────
  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only this employee's Reporting Manager can approve this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.oTRequest.update({
      where: { id: requestId },
      data: { status: 'pending_hr', managerActionByUserId: userId, managerActionAt: new Date() },
    });
    return NextResponse.json({ message: 'Approved by manager, forwarded to HR', data: updated });
  }

  // ── Stage 2: HR approval ───────────────────────────────────────────────
  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
    if (permErr) return permErr;

    const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
    if (freezeErr) return freezeErr;

    const jobInfo = await prisma.jobInfo.findFirst({
      where: { employeeId: record.employeeId, effectiveTo: null },
      select: { overtimeAllowed: true },
    });
    if (!jobInfo?.overtimeAllowed) {
      return NextResponse.json(
        { error: 'This employee is not eligible for overtime (JobInfo.overtimeAllowed is off) — approve their eligibility first.' },
        { status: 400 }
      );
    }

    // A biometric-flagged OT claim can independently be sitting in the same
    // date's row awaiting its own decision. Approving this request would
    // silently mark that other claim 'approved' too, short-circuiting
    // whatever review it was still under — resolve it on the OT Approval
    // page first rather than let the two conflate.
    const existingCheck = await prisma.dailyAttendance.findUnique({
      where: { employeeId_date: { employeeId: record.employeeId, date: record.date } },
      select: { otApprovalStatus: true },
    });
    if (existingCheck?.otApprovalStatus === 'pending_manager' || existingCheck?.otApprovalStatus === 'pending_hr') {
      return NextResponse.json(
        {
          error:
            'This date already has a separate OT claim awaiting approval on the OT Approval page. Resolve that first, then approve this request.',
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyAttendance.findUnique({
        where: { employeeId_date: { employeeId: record.employeeId, date: record.date } },
      });

      // Only decide the day's overall status when there is no row yet — a
      // request against a day that already has one (the normal case: they
      // worked their shift and some OT besides) must not have its status,
      // in/out times, or anything else disturbed by an OT-only approval.
      const freshDayValues = existing
        ? {}
        : {
            status: (await isWeeklyOffForEmployee(scope.companyId, record.employeeId, record.date))
              ? 'WeeklyOff'
              : (await isHolidayOrYearlyLeave(scope.companyId, record.date))
                ? 'Holiday'
                : 'Present',
          };

      await upsertDailyAttendanceWithHistory(
        tx,
        record.employeeId,
        record.date,
        {
          ...freshDayValues,
          otMinutesCalculated: (existing?.otMinutesCalculated ?? 0) + record.requestedMinutes,
          otMinutesApproved: (existing?.otMinutesApproved ?? 0) + record.requestedMinutes,
          otApprovalStatus: 'approved',
          otHrActionByUserId: userId,
          otHrActionAt: new Date(),
          remarks: existing?.remarks
            ? `${existing.remarks} | OT Request #${record.id} approved: +${record.requestedMinutes}m`
            : `OT Request #${record.id} approved: +${record.requestedMinutes}m — ${record.reason}`,
        },
        { userId, changedBySource: 'manual' }
      );

      await tx.oTRequest.update({
        where: { id: requestId },
        data: { status: 'approved', hrActionByUserId: userId, hrActionAt: new Date() },
      });
    });

    await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);

    await notifyEssRequest({
      companyId: scope.companyId,
      kind: 'OT',
      action: 'APPROVED',
      employeeId: record.employeeId,
      requestId: record.id,
      period: formatPeriod(record.date),
      linkPath: '/ess/ot-request',
    });

    const updated = await prisma.oTRequest.findUnique({ where: { id: requestId } });
    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Request is already ${record.status} — nothing to approve` },
    { status: 409 }
  );
}
