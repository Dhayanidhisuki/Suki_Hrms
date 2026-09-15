/**
 * POST /api/workforce/attendance/lom/[id]/approve
 *   — approves a single LOM entry. The approved minutes default to the
 *     canonical LOM figure from computeLomMinutes: shift grace applied to
 *     late minutes only (never to early-out), then the company's daily LOM
 *     cap. Body may override with { approvedMinutes: number }.
 *     RBAC-gated on workforce.ot.approve (HR/Admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { computeLomMinutes } from '@/lib/attendanceCalc';

const bodySchema = z.object({
  approvedMinutes: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
  if (permErr) return permErr;

  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const attendanceId = Number(id);
  const record = await prisma.dailyAttendance.findUnique({
    where: { id: attendanceId },
    include: {
      shiftMaster: { select: { startTime: true, endTime: true, graceMinutes: true } },
      employee: { select: { companyId: true } },
    },
  });
  if (!record) {
    return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
  }

  if (record.lomApprovalStatus !== 'pending') {
    return NextResponse.json({ error: `LOM is already ${record.lomApprovalStatus ?? 'not pending'} — nothing to approve` }, { status: 409 });
  }

  const freezeErr = await checkMonthNotFrozen(record.employeeId, record.date);
  if (freezeErr) return freezeErr;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Default approved minutes = canonical LOM (grace on late only, daily cap).
  const lomConfig = await prisma.lomConfig.findUnique({ where: { companyId: record.employee.companyId } });
  const defaultApproved = computeLomMinutes(
    record.lateMinutes,
    record.earlyOutMinutes,
    record.shiftMaster,
    lomConfig ? { graceMinutesExempt: lomConfig.graceMinutesExempt, dailyLomCap: lomConfig.dailyLomCap } : null
  );
  const approvedMinutes = parsed.data.approvedMinutes ?? defaultApproved;

  const updated = await prisma.dailyAttendance.update({
    where: { id: attendanceId },
    data: {
      lomApprovalStatus: 'approved',
      lomApprovedMinutes: approvedMinutes,
      lomActionByUserId: userId,
      lomActionAt: new Date(),
    },
  });

  await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
  return NextResponse.json(updated);
}
