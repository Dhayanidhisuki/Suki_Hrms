/**
 * POST /api/workforce/attendance/lom/bulk-reject
 *   — bulk-rejects LOM entries. No deduction will apply.
 *     RBAC-gated on workforce.ot.approve (HR/Admin).
 * Body: { ids: number[], rejectionReason: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
  if (permErr) return permErr;

  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, rejectionReason } = parsed.data;

  const records = await prisma.dailyAttendance.findMany({
    where: { id: { in: ids }, lomApprovalStatus: 'pending' },
  });

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
      await prisma.dailyAttendance.update({
        where: { id: record.id },
        data: {
          lomApprovalStatus: 'rejected',
          lomRejectionReason: rejectionReason,
          lomActionByUserId: userId,
          lomActionAt: new Date(),
        },
      });
      await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
      results.push({ id: record.id, status: 'ok' });
      rejected++;
    } catch (err) {
      results.push({ id: record.id, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  skipped += ids.length - records.length;

  return NextResponse.json({ rejected, skipped, total: ids.length, results });
}
