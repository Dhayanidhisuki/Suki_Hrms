/**
 * POST /api/workforce/attendance/lom/bulk-approve
 *   — bulk-approves LOM entries. Approved minutes per row come from the
 *     canonical computeLomMinutes (shift grace on late only, then the
 *     company's daily LOM cap).
 *     RBAC-gated on workforce.ot.approve (HR/Admin).
 * Body: { ids: number[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { computeLomMinutes, type LomConfigLite } from '@/lib/attendanceCalc';

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
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

  const { ids } = parsed.data;

  const records = await prisma.dailyAttendance.findMany({
    where: { id: { in: ids }, lomApprovalStatus: 'pending' },
    include: {
      shiftMaster: { select: { startTime: true, endTime: true, graceMinutes: true } },
      employee: { select: { companyId: true } },
    },
  });

  // One LomConfig fetch per company touched by the batch (normally one).
  const companyIds = Array.from(new Set(records.map((r) => r.employee.companyId)));
  const lomConfigs = await prisma.lomConfig.findMany({ where: { companyId: { in: companyIds } } });
  const lomConfigByCompany = new Map<number, LomConfigLite>(
    lomConfigs.map((c) => [c.companyId, { graceMinutesExempt: c.graceMinutesExempt, dailyLomCap: c.dailyLomCap }])
  );

  const results: { id: number; status: 'ok' | 'skipped' | 'error'; message?: string }[] = [];
  let approved = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const approvedMinutes = computeLomMinutes(
        record.lateMinutes,
        record.earlyOutMinutes,
        record.shiftMaster,
        lomConfigByCompany.get(record.employee.companyId) ?? null
      );

      await prisma.dailyAttendance.update({
        where: { id: record.id },
        data: {
          lomApprovalStatus: 'approved',
          lomApprovedMinutes: approvedMinutes,
          lomActionByUserId: userId,
          lomActionAt: new Date(),
        },
      });
      await refreshMonthlySummary(record.employeeId, record.date.getUTCFullYear(), record.date.getUTCMonth() + 1);
      results.push({ id: record.id, status: 'ok' });
      approved++;
    } catch (err) {
      results.push({ id: record.id, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // Count IDs that weren't pending (skipped)
  const notPending = ids.length - records.length;
  if (notPending > 0) {
    skipped = notPending;
  }

  return NextResponse.json({ approved, skipped, total: ids.length, results });
}
