/**
 * POST /api/workforce/attendance/ot/[id]/approve
 *
 * [id] is the DailyAttendance row's own id — OT isn't a separate request
 * table, it's tracked directly on the day (see schema.prisma's
 * DailyAttendance.otApprovalStatus comment). Same two-stage dispatch as
 * Mispunch's approve route: which check applies depends on the row's
 * current otApprovalStatus.
 *
 *   - pending_manager: caller must be this employee's own Reporting
 *     Manager (hierarchy check). Advances to pending_hr.
 *   - pending_hr: caller must hold workforce.ot.approve. Body may include
 *     { settlementType: 'OT' | 'COMP_OFF', approvedMinutes?: number }.
 *     COMP_OFF is only allowed when the day is a Sunday or a declared
 *     holiday (HolidayMaster) — BRD: "Always Sunday is weekly off... work
 *     means consider as Comp-off & OT", extended to Holiday once
 *     HolidayMaster existed to detect it. Any other day is always settled
 *     as OT regardless of what's sent.
 *     COMP_OFF grants 1 Compensatory Off day instead of approving paid OT
 *     minutes (otMinutesApproved stays null in that case — nothing to bill
 *     as overtime pay).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { grantCompOff } from '@/lib/leaveAccrual';
import { creditCompOff } from '@/lib/compOffTransactions';
import { isWeeklyOffForEmployee, isHolidayOrYearlyLeave } from '@/lib/weeklyOff';

import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

const bodySchema = z.object({
  settlementType: z.enum(['OT', 'COMP_OFF']).default('OT'),
  approvedMinutes: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const attendanceId = Number(id);
  const record = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
  if (!record) {
    return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
  }

  if (record.otApprovalStatus === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
      return NextResponse.json({ error: "Forbidden — only this employee's Reporting Manager can approve this stage" }, { status: 403 });
    }
    await upsertDailyAttendanceWithHistory(
      prisma,
      record.employeeId,
      record.date,
      {
        otApprovalStatus: 'pending_hr',
        otManagerActionByUserId: userId,
        otManagerActionAt: new Date(),
      },
      { userId, changedBySource: 'manual' }
    );
    await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
    const updated = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
    return NextResponse.json(updated);
  }

  if (record.otApprovalStatus === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
    if (permErr) return permErr;

    const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
    if (freezeErr) return freezeErr;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // COMP_OFF is allowed when the day is a weekly off (per department config)
    // or a declared holiday / yearly leave. BRD: "work on weekly off means
    // consider as Comp-off & OT". Any other day is always settled as OT.
    const employee = await prisma.employee.findUnique({ where: { id: record.employeeId }, select: { companyId: true } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    const isWeeklyOff = await isWeeklyOffForEmployee(employee.companyId, record.employeeId, record.date);
    const isHoliday = await isHolidayOrYearlyLeave(employee.companyId, record.date);
    const settlementType = isWeeklyOff || isHoliday ? parsed.data.settlementType : 'OT';

    if (settlementType === 'COMP_OFF') {
      await grantCompOff(record.employeeId, record.date);
      await creditCompOff(record.employeeId, 1, record.date, 'OT_APPROVAL', attendanceId, `OT approved as comp-off on ${record.date.toISOString().slice(0, 10)}`);
      await upsertDailyAttendanceWithHistory(
        prisma,
        record.employeeId,
        record.date,
        {
          otApprovalStatus: 'approved',
          otSettlementType: 'COMP_OFF',
          otMinutesApproved: null,
          otHrActionByUserId: userId,
          otHrActionAt: new Date(),
        },
        { userId, changedBySource: 'manual' }
      );
      await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
      const updated = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
      await notifyEssRequest({
        kind: 'OT',
        action: 'APPROVED',
        employeeId: record.employeeId,
        requestId: attendanceId,
        period: formatPeriod(record.date),
        reason: undefined,
        linkPath: '/ess/ot',
      });

      return NextResponse.json(updated);
    }

    await upsertDailyAttendanceWithHistory(
      prisma,
      record.employeeId,
      record.date,
      {
        otApprovalStatus: 'approved',
        otSettlementType: 'OT',
        otMinutesApproved: parsed.data.approvedMinutes ?? record.otMinutesCalculated,
        otHrActionByUserId: userId,
        otHrActionAt: new Date(),
      },
      { userId, changedBySource: 'manual' }
    );
    await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
    const updated = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
    await notifyEssRequest({
      kind: 'OT',
      action: 'APPROVED',
      employeeId: record.employeeId,
      requestId: attendanceId,
      period: formatPeriod(record.date),
      reason: undefined,
      linkPath: '/ess/ot',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: `OT is already ${record.otApprovalStatus ?? 'not pending'} — nothing to approve` }, { status: 409 });
}
