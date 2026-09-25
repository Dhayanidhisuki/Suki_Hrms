/**
 * POST /api/workforce/on-duty/[id]/approve
 *
 * One endpoint for both approval stages — which one applies is decided by
 * the record's current status, not by the caller:
 *   - status=pending_manager: caller must be the requester's Reporting
 *     Manager (Level 1 or Level 2). Advances to pending_hr. No
 *     DailyAttendance write yet.
 *   - status=pending_hr: caller must hold workforce.on-duty.approve. This
 *     is the ONLY step that touches DailyAttendance — every date in
 *     [fromDate, toDate] is marked status='OnDuty' (counted as present),
 *     written through upsertDailyAttendanceWithHistory so any prior value
 *     is preserved in history, then each affected month's
 *     MonthlyAttendanceSummary is refreshed. Respects the frozen-month
 *     guard exactly like every other attendance write in this app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { findLinkedLeaveDates, linkedLeaveMessage } from '@/lib/leave/leaveDays';

import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const requestId = Number(id);
  const record = await prisma.onDutyRequest.findUnique({ where: { id: requestId } });
  if (!record) {
    return NextResponse.json({ error: 'On-Duty request not found' }, { status: 404 });
  }

  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can approve this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.onDutyRequest.update({
      where: { id: requestId },
      data: { status: 'pending_hr', managerActionByUserId: userId, managerActionAt: new Date() },
    });
    return NextResponse.json({ message: 'Approved by manager, forwarded to HR', data: updated });
  }

  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.on-duty.approve');
    if (permErr) return permErr;

    const dates = eachDate(record.fromDate, record.toDate);
    for (const date of dates) {
      const freezeErr = await checkMonthNotFrozen(record.employeeId, date);
      if (freezeErr) return freezeErr;
    }
    const linked = await findLinkedLeaveDates(record.employeeId, dates);
    if (linked.length > 0) return NextResponse.json({ error: linkedLeaveMessage(linked) }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      for (const date of dates) {
        await upsertDailyAttendanceWithHistory(
          tx,
          record.employeeId,
          date,
          { status: 'OnDuty', remarks: `On-Duty request #${record.id}: ${record.purpose}` },
          { userId, changedBySource: 'manual' }
        );
      }
      await tx.onDutyRequest.update({
        where: { id: requestId },
        data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date() },
      });
    });

    const months = new Set(dates.map((d) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`));
    for (const key of months) {
      const [year, month] = key.split('-').map(Number);
      await refreshMonthlySummary(record.employeeId, year, month);
    }

    const updated = await prisma.onDutyRequest.findUnique({ where: { id: requestId } });

    await notifyEssRequest({
      kind: 'ON_DUTY',
      action: 'APPROVED',
      employeeId: record.employeeId,
      requestId: requestId,
      period: formatPeriod(record.fromDate, record.toDate),
      reason: record.purpose,
      linkPath: '/ess/on-duty',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Request is already ${record.status} — nothing to approve` },
    { status: 409 }
  );
}
