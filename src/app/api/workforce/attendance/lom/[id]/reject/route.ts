/**
 * POST /api/workforce/attendance/lom/[id]/reject  { rejectionReason }
 *   — rejects a single LOM entry. No deduction will apply.
 *     RBAC-gated on workforce.ot.approve (HR/Admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

const bodySchema = z.object({ rejectionReason: z.string().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const attendanceId = Number(id);
  const record = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
  if (!record) {
    return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
  }

  if (record.lomApprovalStatus !== 'pending') {
    return NextResponse.json({ error: `LOM is already ${record.lomApprovalStatus ?? 'not pending'} — nothing to reject` }, { status: 409 });
  }

  // Payroll's LOM fallback deducts pending rows and skips rejected ones, so
  // a rejection after the lock would change what was paid.
  const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
  if (freezeErr) return freezeErr;

  const updated = await prisma.dailyAttendance.update({
    where: { id: attendanceId },
    data: {
      lomApprovalStatus: 'rejected',
      lomRejectionReason: parsed.data.rejectionReason,
      lomActionByUserId: userId,
      lomActionAt: new Date(),
    },
  });

  await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
  return NextResponse.json(updated);
}
