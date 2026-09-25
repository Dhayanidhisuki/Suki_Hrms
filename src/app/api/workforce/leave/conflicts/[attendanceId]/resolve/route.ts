/**
 * POST /api/workforce/leave/conflicts/[attendanceId]/resolve
 * Body: { decision: 'present' | 'keep_leave', note?: string }
 *
 * HR decides a punch that landed on an approved leave day (client rule,
 * 2026-09-25: never auto-decided).
 *
 *   present    — the employee worked: that ONE date leaves the leave. The
 *                balance is credited back (1 or 0.5; comp-off ledger for
 *                COMPOFF; nothing for unpaid), the application's day count
 *                drops and daysReversed rises, the row is restored from the
 *                conflict punches (Present / HalfDay / MissingPunch by the
 *                normal derivation), a sandwiched weekly off that is no
 *                longer between two leave days is restored, and an
 *                application whose count reaches zero is cancelled.
 *   keep_leave — the leave stands. Only the decision is recorded; the
 *                conflict punches stay on the row so the next sync does not
 *                re-flag the same evidence.
 *
 * Requires workforce.leave.approve; refuses a locked month.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { creditCompOff } from '@/lib/compOffTransactions';
import { buildRestoreContext, restoreLeaveDay, unsandwich, LEAVE_TX_OPTS } from '@/lib/leave/leaveDays';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

const bodySchema = z.object({
  decision: z.enum(['present', 'keep_leave']),
  note: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ attendanceId: string }> }) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const userId = Number(request.headers.get('x-user-id')) || null;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { decision, note } = parsed.data;

  const { attendanceId } = await params;
  const row = await prisma.dailyAttendance.findFirst({
    where: { id: Number(attendanceId), employee: { companyId: scope.companyId, deletedAt: null } },
    include: { leaveApplication: { include: { leaveMaster: { select: { code: true, isPaid: true } } } } },
  });
  if (!row || !row.leaveConflictInTime) {
    return NextResponse.json({ error: 'No leave conflict on this day' }, { status: 404 });
  }
  if (row.leaveConflictDecision) {
    return NextResponse.json({ error: `Already decided: ${row.leaveConflictDecision}` }, { status: 409 });
  }
  const app = row.leaveApplication;
  if (!app || row.leaveApplicationId == null) {
    return NextResponse.json({ error: 'This day is no longer linked to a leave application' }, { status: 409 });
  }

  const freezeErr = await checkMonthNotFrozen(row.employeeId, row.date);
  if (freezeErr) return freezeErr;

  const decided = { leaveConflictDecision: decision, leaveConflictDecidedAt: new Date(), leaveConflictDecidedByUserId: userId };

  if (decision === 'keep_leave') {
    const res = await prisma.dailyAttendance.updateMany({
      where: { id: row.id, leaveConflictDecision: null },
      data: decided,
    });
    if (res.count === 0) return NextResponse.json({ error: 'Already decided' }, { status: 409 });
    await notifyEssRequest({
      companyId: scope.companyId,
      kind: 'LEAVE',
      action: 'CONFLICT_RESOLVED',
      employeeId: row.employeeId,
      requestId: app.id,
      period: formatPeriod(row.date),
      reason: `Leave stands for ${formatPeriod(row.date)}${note ? ` — ${note}` : ''}`,
      linkPath: '/ess/leave',
    });
    return NextResponse.json({ decision, restoredStatus: null });
  }

  // ── present ───────────────────────────────────────────────────────────
  const daysBack = row.leaveDayKind === 'HALF' ? 0.5 : row.leaveDayKind === 'SANDWICH' ? 1 : 1;
  const refundable = app.leaveMaster.isPaid && app.leaveMaster.code !== 'COMPOFF';
  const ctx = await buildRestoreContext(scope.companyId, row.employeeId, app.fromDate, app.toDate, userId);
  const touched = new Set<string>([`${row.date.getUTCFullYear()}-${row.date.getUTCMonth() + 1}`]);

  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.dailyAttendance.updateMany({
      where: { id: row.id, leaveConflictDecision: null, leaveApplicationId: app.id },
      data: decided,
    });
    if (claimed.count === 0) return null;

    const fresh = await tx.dailyAttendance.findUniqueOrThrow({ where: { id: row.id } });
    const restoredStatus = await restoreLeaveDay(tx, fresh, ctx);

    // A weekly off that was LOP only because it sat between two leave days
    // may no longer be sandwiched; those days leave the count too (unpaid
    // types only have sandwich days, so no ledger is involved).
    const unsandwiched = await unsandwich(tx, app.id, ctx);
    for (const d of unsandwiched) touched.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);

    const remaining = Math.max(0, Number(app.numberOfDays) - daysBack - unsandwiched.length);
    await tx.leaveApplication.update({
      where: { id: app.id },
      data: {
        numberOfDays: remaining,
        daysReversed: { increment: daysBack + unsandwiched.length },
        reversalNote: [app.reversalNote, `${formatPeriod(row.date)}: present${note ? ` (${note})` : ''}`].filter(Boolean).join(' | ').slice(0, 500),
        ...(remaining === 0 ? { status: 'cancelled', cancelledAt: new Date(), cancelledByUserId: userId } : {}),
      },
    });

    if (refundable) {
      await tx.leaveBalance.updateMany({
        where: { employeeId: row.employeeId, leaveMasterId: app.leaveMasterId, year: app.fromDate.getUTCFullYear() },
        data: { availed: { decrement: daysBack }, closingBalance: { increment: daysBack } },
      });
    }

    return { restoredStatus, remaining };
  }, LEAVE_TX_OPTS);

  if (!outcome) return NextResponse.json({ error: 'Already decided' }, { status: 409 });

  for (const key of touched) {
    const [y, m] = key.split('-').map(Number);
    await refreshMonthlySummary(row.employeeId, y, m);
  }

  if (app.leaveMaster.code === 'COMPOFF') {
    await creditCompOff(row.employeeId, daysBack, row.date, 'LEAVE_CANCELLED', app.id, `Comp-off leave day ${formatPeriod(row.date)} reversed — employee worked`);
  }

  await notifyEssRequest({
    companyId: scope.companyId,
    kind: 'LEAVE',
    action: 'CONFLICT_RESOLVED',
    employeeId: row.employeeId,
    requestId: app.id,
    period: formatPeriod(row.date),
    reason: `${formatPeriod(row.date)} counted as worked; ${daysBack} day(s) returned to your balance${note ? ` — ${note}` : ''}`,
    linkPath: '/ess/leave',
  });

  return NextResponse.json({ decision, ...outcome, daysReturned: refundable || app.leaveMaster.code === 'COMPOFF' ? daysBack : 0 });
}
