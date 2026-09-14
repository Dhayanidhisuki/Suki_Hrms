/**
 * POST /api/workforce/attendance/ot/bulk-approve
 *
 * Bulk-approves OT entries. Two-stage dispatch per row:
 *   - pending_manager: caller must be the employee's Reporting Manager.
 *     Advances to pending_hr (settlementType is ignored at this stage).
 *   - pending_hr: caller must hold workforce.ot.approve. Body's
 *     settlementType ('OT' | 'COMP_OFF') applies to Sunday/Holiday rows
 *     only; weekday rows are always settled as OT.
 *
 * Body: { ids: number[], settlementType?: 'OT' | 'COMP_OFF' }
 * Returns per-row results so the UI can show partial failures.
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

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
  settlementType: z.enum(['OT', 'COMP_OFF']).default('OT'),
});

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, settlementType: requestedSettlement } = parsed.data;

  // Fetch all requested rows in one query.
  const records = await prisma.dailyAttendance.findMany({
    where: { id: { in: ids } },
    include: { employee: { select: { companyId: true } } },
  });

  if (records.length === 0) {
    return NextResponse.json({ error: 'No matching attendance records found' }, { status: 404 });
  }

  // Determine whether the caller can act on pending_hr rows (HR permission).
  let hasHrPermission = false;
  try {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
    hasHrPermission = !permErr;
  } catch {
    hasHrPermission = false;
  }

  // Determine whether the caller is a reporting manager (resolved once).
  const ownEmployeeId = await resolveOwnEmployeeId(userId);

  const results: { id: number; status: 'ok' | 'skipped' | 'error'; message?: string }[] = [];
  let approved = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      if (record.otApprovalStatus === 'pending_manager') {
        // Manager stage — check hierarchy.
        if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
          results.push({ id: record.id, status: 'skipped', message: 'Not the reporting manager' });
          skipped++;
          continue;
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
        results.push({ id: record.id, status: 'ok' });
        approved++;
      } else if (record.otApprovalStatus === 'pending_hr') {
        // HR stage — check permission.
        if (!hasHrPermission) {
          results.push({ id: record.id, status: 'skipped', message: 'HR permission required' });
          skipped++;
          continue;
        }
        const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
        if (freezeErr) {
          results.push({ id: record.id, status: 'skipped', message: 'Month is frozen' });
          skipped++;
          continue;
        }

        const isWeeklyOff = await isWeeklyOffForEmployee(record.employeeId, record.date);
        const isHoliday = await isHolidayOrYearlyLeave(record.employee.companyId, record.date);
        const settlementType = isWeeklyOff || isHoliday ? requestedSettlement : 'OT';

        if (settlementType === 'COMP_OFF') {
          await grantCompOff(record.employeeId, record.date);
          await creditCompOff(record.employeeId, 1, record.date, 'OT_APPROVAL', record.id, `Bulk OT approved as comp-off on ${record.date.toISOString().slice(0, 10)}`);
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
        } else {
          await upsertDailyAttendanceWithHistory(
            prisma,
            record.employeeId,
            record.date,
            {
              otApprovalStatus: 'approved',
              otSettlementType: 'OT',
              otMinutesApproved: record.otMinutesCalculated,
              otHrActionByUserId: userId,
              otHrActionAt: new Date(),
            },
            { userId, changedBySource: 'manual' }
          );
        }
        await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
        results.push({ id: record.id, status: 'ok' });
        approved++;
      } else {
        results.push({ id: record.id, status: 'skipped', message: `Already ${record.otApprovalStatus ?? 'processed'}` });
        skipped++;
      }
    } catch (err) {
      results.push({ id: record.id, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ approved, skipped, total: ids.length, results });
}
