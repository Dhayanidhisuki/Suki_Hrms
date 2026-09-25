/**
 * GET  /api/workforce/mispunch?scope=mine|manager|hr
 *      — mine: the logged-in employee's own requests, any status.
 *      — manager: requests awaiting the logged-in employee's own approval
 *        as Reporting Manager (status=pending_manager, employee.reportingManagerId
 *        = caller). Hierarchy-gated, not RBAC-permission-gated — see
 *        src/lib/reportingManager.ts.
 *      — hr: requests awaiting final HR approval (status=pending_hr),
 *        gated by the workforce.mispunch.view permission.
 * POST /api/workforce/mispunch
 *      — the logged-in employee applies for a correction to one of their
 *        own days. Self-service: employeeId is resolved from the session,
 *        never taken from the request body. Starts at status=pending_manager.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { mispunchRequestSchema } from '@/lib/validations/workforce';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';
import { getMispunchPolicy } from '@/lib/mispunchPolicy';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { findLinkedLeaveDates, linkedLeaveMessage } from '@/lib/leave/leaveDays';


const OPEN_OR_APPROVED = ['pending_manager', 'pending_hr', 'approved'] as const;

/** How many mis-punch requests this employee has already used for the calendar month `on` falls in. */
async function countUsedForMonth(employeeId: number, on: Date): Promise<number> {
  const monthStart = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth() + 1, 1));
  return prisma.mispunchCorrection.count({
    where: { employeeId, date: { gte: monthStart, lt: monthEnd }, status: { in: [...OPEN_OR_APPROVED] } },
  });
}

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'mine';
  const include = {
    employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true } },
  };

  if (scopeParam === 'mine') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.mispunchCorrection.findMany({
      where: { employeeId: ownEmployeeId },
      include,
      orderBy: { appliedAt: 'desc' },
    });
    const policy = await getMispunchPolicy(scope.companyId);
    const usedCount = await countUsedForMonth(ownEmployeeId, new Date());
    return NextResponse.json({
      data,
      policy: {
        maxBackdateDays: policy.maxBackdateDays,
        maxRequestsPerMonth: policy.maxRequestsPerMonth,
        usedCount,
        remainingCount: Math.max(0, policy.maxRequestsPerMonth - usedCount),
      },
    });
  }

  if (scopeParam === 'manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.mispunchCorrection.findMany({
      where: { status: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.mispunch.view');
    if (permErr) return permErr;
    const data = await prisma.mispunchCorrection.findMany({
      where: { status: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  // What this caller has already acted on, at either stage. Needs no grant:
  // it is filtered to their own recorded action, so it can only ever return
  // requests they personally decided. Without this an approval vanishes the
  // moment it is actioned, leaving the approver no record of what they did.
  if (scopeParam === 'actioned') {
    const data = await prisma.mispunchCorrection.findMany({
      where: {
        employee: { companyId: scope.companyId },
        OR: [{ managerActionByUserId: userId }, { hrActionByUserId: userId }],
      },
      include,
      orderBy: [{ hrActionAt: 'desc' }, { managerActionAt: 'desc' }],
      take: 50,
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: mine, manager, hr, actioned' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = mispunchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Locked month (frozen / handed to payroll / payroll processed): tell the
  // employee now rather than let a request sit that HR can never approve.
  const freezeErr = await checkMonthNotFrozen(ownEmployeeId, parsed.data.date);
  if (freezeErr) return freezeErr;

  // A full-day approved leave cannot be "corrected" into a worked day —
  // that is a leave conflict for HR (or a leave cancel). Half-day leave is
  // fine: the worked half may need its punch fixed.
  const linked = await findLinkedLeaveDates(ownEmployeeId, [parsed.data.date], { allowHalf: true });
  if (linked.length > 0) return NextResponse.json({ error: linkedLeaveMessage(linked) }, { status: 409 });

  const policy = await getMispunchPolicy(scope.companyId);

  // How far back this correction can be dated — configured in Masters, not hardcoded.
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const reqUTC = Date.UTC(parsed.data.date.getUTCFullYear(), parsed.data.date.getUTCMonth(), parsed.data.date.getUTCDate());
  const daysBack = Math.round((todayUTC - reqUTC) / 86_400_000);
  if (daysBack > policy.maxBackdateDays) {
    return NextResponse.json(
      { error: `Cannot request a correction more than ${policy.maxBackdateDays} days in the past.` },
      { status: 400 }
    );
  }

  // Hard cap on requests per calendar month (the month the requested date falls in).
  const usedThisMonth = await countUsedForMonth(ownEmployeeId, parsed.data.date);
  if (usedThisMonth >= policy.maxRequestsPerMonth) {
    return NextResponse.json(
      { error: `You've reached your limit of ${policy.maxRequestsPerMonth} mis-punch requests for this month.` },
      { status: 400 }
    );
  }

  // One open correction per day. Without this an employee could stack several
  // requests for the same date, and whichever the approver actioned last would
  // silently overwrite the attendance the earlier ones had already written.
  const existing = await prisma.mispunchCorrection.findFirst({
    where: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      status: { in: ['pending_manager', 'pending_hr'] },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You already have a correction request for this date awaiting approval (#${existing.id}). Withdraw it or wait for it to be actioned before raising another.` },
      { status: 409 }
    );
  }

  const record = await prisma.mispunchCorrection.create({
    data: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      requestedInTime: parsed.data.requestedInTime ?? null,
      requestedOutTime: parsed.data.requestedOutTime ?? null,
      reason: parsed.data.reason,
    },
  });

  await notifyEssRequest({
    kind: 'MISPUNCH',
    action: 'SUBMITTED',
    employeeId: record.employeeId,
    requestId: record.id,
    period: formatPeriod(record.date),
    reason: record.reason,
    linkPath: '/approvals/workforce/mispunch',
  });

  return NextResponse.json(record, { status: 201 });
}
