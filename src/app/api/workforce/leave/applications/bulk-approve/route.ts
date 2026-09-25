/**
 * POST /api/workforce/leave/applications/bulk-approve
 *
 * Bulk-approves leave applications. Two-stage dispatch per row, matching the
 * single-row approve route exactly:
 *   - pending_manager: caller must be the employee's Reporting Manager
 *     (Level 1 or 2). Advances to pending_hr. No ledger or attendance write.
 *   - pending_hr: caller must hold workforce.leave.approve. Runs the same
 *     guards and commit as the single route via commitLeaveApproval —
 *     balance ledger, DailyAttendance, monthly summary, comp-off ledger.
 *
 * Body: { ids: number[] }
 * Returns per-row results so the UI can show partial failures — a frozen
 * month or an overdrawn balance skips that row and leaves the rest alone,
 * the same way the OT bulk-approve behaves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import {
  checkCanApprove,
  commitLeaveApproval,
  planFor,
  type LeaveApprovalTarget,
  type BulkLeaveResult,
} from '@/lib/leave/finalizeApproval';

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
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
  const { ids } = parsed.data;

  const records = await prisma.leaveApplication.findMany({
    where: { id: { in: ids }, employee: { companyId: scope.companyId, deletedAt: null } },
    include: {
      leaveMaster: { select: { code: true, isPaid: true, countSandwichedNonWorking: true } },
      employee: { select: { employeeCode: true } },
    },
  });
  if (records.length === 0) {
    return NextResponse.json({ error: 'No matching leave applications found' }, { status: 404 });
  }

  // Resolve the caller's capabilities once rather than per row.
  let hasHrPermission = false;
  try {
    hasHrPermission = !(await checkSpecificPermission(request, 'workforce.leave.approve'));
  } catch {
    hasHrPermission = false;
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);

  const results: BulkLeaveResult[] = [];
  let approved = 0;
  let skipped = 0;

  // Sequential on purpose: approving moves a shared balance, so two rows for
  // the same employee must be evaluated in order or both could pass a check
  // the pair then overdraws.
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
          data: { status: 'pending_hr', managerActionByUserId: userId, managerActionAt: new Date() },
        });
        results.push({ ...base, status: 'ok', stage: 'manager', message: 'Forwarded to HR' });
        approved++;
      } else if (record.status === 'pending_hr') {
        if (!hasHrPermission) {
          results.push({ ...base, status: 'skipped', stage: 'hr', message: 'HR permission required' });
          skipped++;
          continue;
        }
        const target: LeaveApprovalTarget = {
          id: record.id,
          companyId: scope.companyId,
          employeeId: record.employeeId,
          leaveMasterId: record.leaveMasterId,
          fromDate: record.fromDate,
          toDate: record.toDate,
          numberOfDays: Number(record.numberOfDays),
          isHalfDay: record.isHalfDay,
          leaveCode: record.leaveMaster.code,
          isPaid: record.leaveMaster.isPaid,
          countSandwichedNonWorking: record.leaveMaster.countSandwichedNonWorking,
        };
        const plan = await planFor(target);
        const blocked = await checkCanApprove(target, plan);
        if (blocked) {
          results.push({ ...base, status: 'skipped', stage: 'hr', message: blocked.message });
          skipped++;
          continue;
        }
        await commitLeaveApproval(target, plan, userId);
        results.push({ ...base, status: 'ok', stage: 'hr', message: 'Approved' });
        approved++;
      } else {
        results.push({ ...base, status: 'skipped', message: `Already ${record.status}` });
        skipped++;
      }
    } catch (err) {
      results.push({ ...base, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ approved, skipped, total: ids.length, results });
}
