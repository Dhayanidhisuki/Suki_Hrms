/**
 * POST /api/workforce/leave/applications/bulk-reject
 *
 * Bulk-rejects leave applications, mirroring the single-row reject route:
 *   - pending_manager: caller must be the employee's Reporting Manager
 *     (Level 1 or 2). Stores managerRejectionReason.
 *   - pending_hr: caller must hold workforce.leave.approve. Stores
 *     rejectionReason.
 *
 * Body: { ids: number[], rejectionReason: string }
 * Rejection never touches the balance ledger (BRD §11: "Rejected leave shall
 * not reduce leave balance"), so this is a straight status update per row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import type { BulkLeaveResult } from '@/lib/leave/finalizeApproval';

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
  rejectionReason: z.string().trim().min(1, 'Rejection reason is required').max(500),
});

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, rejectionReason } = parsed.data;

  const records = await prisma.leaveApplication.findMany({
    where: { id: { in: ids }, employee: { companyId: scope.companyId, deletedAt: null } },
    include: { employee: { select: { employeeCode: true } } },
  });
  if (records.length === 0) {
    return NextResponse.json({ error: 'No matching leave applications found' }, { status: 404 });
  }

  let hasHrPermission = false;
  try {
    hasHrPermission = !(await checkSpecificPermission(request, 'workforce.leave.approve'));
  } catch {
    hasHrPermission = false;
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);

  const results: BulkLeaveResult[] = [];
  let rejected = 0;
  let skipped = 0;

  for (const record of records) {
    const base = { id: record.id, employeeCode: record.employee.employeeCode };
    try {
      if (record.status === 'pending_manager') {
        if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
          results.push({ ...base, status: 'skipped', stage: 'manager', message: 'Not the reporting manager' });
          skipped++;
          continue;
        }
        await prisma.leaveApplication.update({
          where: { id: record.id },
          data: { status: 'rejected', managerRejectionReason: rejectionReason },
        });
        results.push({ ...base, status: 'ok', stage: 'manager', message: 'Rejected' });
        rejected++;
      } else if (record.status === 'pending_hr') {
        if (!hasHrPermission) {
          results.push({ ...base, status: 'skipped', stage: 'hr', message: 'HR permission required' });
          skipped++;
          continue;
        }
        await prisma.leaveApplication.update({
          where: { id: record.id },
          data: { status: 'rejected', rejectionReason },
        });
        results.push({ ...base, status: 'ok', stage: 'hr', message: 'Rejected' });
        rejected++;
      } else {
        results.push({ ...base, status: 'skipped', message: `Already ${record.status}` });
        skipped++;
      }
    } catch (err) {
      results.push({ ...base, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ rejected, skipped, total: ids.length, results });
}
