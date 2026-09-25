/**
 * POST /api/workforce/attendance/ot/bulk-reject
 *
 * Bulk-rejects OT entries. Same two-stage dispatch as single reject:
 *   - pending_manager: caller must be the Reporting Manager.
 *   - pending_hr: caller must hold workforce.ot.approve.
 *
 * Body: { ids: number[], rejectionReason: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
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

  const { ids, rejectionReason } = parsed.data;

  const records = await prisma.dailyAttendance.findMany({ where: { id: { in: ids } } });
  if (records.length === 0) {
    return NextResponse.json({ error: 'No matching attendance records found' }, { status: 404 });
  }

  let hasHrPermission = false;
  try {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
    hasHrPermission = !permErr;
  } catch {
    hasHrPermission = false;
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);

  const results: { id: number; status: 'ok' | 'skipped' | 'error'; message?: string }[] = [];
  let rejected = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      if (await checkMonthNotFrozen(record.employeeId, record.date)) {
        results.push({ id: record.id, status: 'skipped', message: 'Month is locked' });
        skipped++;
        continue;
      }
      if (record.otApprovalStatus === 'pending_manager') {
        if (!ownEmployeeId || !(await isReportingManagerOf(ownEmployeeId, record.employeeId))) {
          results.push({ id: record.id, status: 'skipped', message: 'Not the reporting manager' });
          skipped++;
          continue;
        }
        await prisma.dailyAttendance.update({
          where: { id: record.id },
          data: {
            otApprovalStatus: 'rejected',
            otRejectionReason: rejectionReason,
            otManagerActionByUserId: userId,
            otManagerActionAt: new Date(),
          },
        });
        await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
        results.push({ id: record.id, status: 'ok' });
        rejected++;
      } else if (record.otApprovalStatus === 'pending_hr') {
        if (!hasHrPermission) {
          results.push({ id: record.id, status: 'skipped', message: 'HR permission required' });
          skipped++;
          continue;
        }
        await prisma.dailyAttendance.update({
          where: { id: record.id },
          data: {
            otApprovalStatus: 'rejected',
            otRejectionReason: rejectionReason,
            otHrActionByUserId: userId,
            otHrActionAt: new Date(),
          },
        });
        await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
        results.push({ id: record.id, status: 'ok' });
        rejected++;
      } else {
        results.push({ id: record.id, status: 'skipped', message: `Already ${record.otApprovalStatus ?? 'processed'}` });
        skipped++;
      }
    } catch (err) {
      results.push({ id: record.id, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ rejected, skipped, total: ids.length, results });
}
