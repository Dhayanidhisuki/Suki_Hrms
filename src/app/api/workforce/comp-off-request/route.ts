/**
 * GET  /api/workforce/comp-off-request
 *   — list comp-off requests. Employees see their own; HR/admins see all.
 * POST /api/workforce/comp-off-request
 *   — create a comp-off request. Body: { workedDate, requestedDate, reason? }
 *   Validates that the employee has approved weekly-off/holiday work on workedDate
 *   and hasn't already claimed comp-off for that date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { creditCompOff, getCompOffBalance } from '@/lib/compOffTransactions';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');

// LeaveApplication's two-stage pending_manager/pending_hr statuses pass
// through as-is — src/app/ess/comp-off/page.tsx renders both distinctly,
// same as the Leave page, instead of collapsing them into one ambiguous
// "Pending" that loses which stage the request is actually stuck at.
const LEAVE_STATUS_TO_COMPOFF: Record<string, string> = {
  pending_manager: 'pending_manager',
  pending_hr: 'pending_hr',
  approved: 'approved',
  rejected: 'rejected',
};
const LEAVE_STATUS_BY_FILTER: Record<string, string[]> = {
  pending: ['pending_manager', 'pending_hr'],
  approved: ['approved'],
  rejected: ['rejected'],
};

const createSchema = z.object({
  workedDate: isoDate,
  requestedDate: isoDate,
  reason: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const statusFilter = request.nextUrl.searchParams.get('status');

  // Check if the caller is HR/admin (can see all)
  let isHr = false;
  try {
    const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
    isHr = !permErr;
  } catch {
    isHr = false;
  }

  const where: Record<string, unknown> = {
    employee: { companyId: scope.companyId },
  };

  // A running balance only means something for one specific employee — for
  // the HR "all requests" view there is no single "the" balance to attach,
  // so this stays null there and is only ever populated on the self-service
  // path, same shape /api/workforce/permission?scope=mine already uses.
  let balance = null;
  if (!isHr) {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    where.employeeId = ownEmployeeId;
    const b = await getCompOffBalance(ownEmployeeId);
    balance = {
      available: Number(b.balance),
      earned: Number(b.earned),
      used: Number(b.used),
      expired: Number(b.expired),
      encashed: Number(b.encashed),
    };
  }

  if (statusFilter) where.status = statusFilter;

  const requestRows = await prisma.compOffRequest.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Self-service Comp-Off can also be applied through the regular Apply for
  // Leave form (leaveMaster.code === 'COMPOFF'), which writes a
  // LeaveApplication instead of a CompOffRequest row — a separate table with
  // no "worked date" of its own. Merge both sources here so this page shows
  // every Comp-Off request regardless of which form was used to apply,
  // rather than only ever showing the CompOffRequest-table half.
  let leaveAppRows: typeof requestRows = [];
  if (!isHr) {
    const ownEmployeeId = (where as { employeeId?: number }).employeeId;
    const leaveApps = await prisma.leaveApplication.findMany({
      where: {
        employeeId: ownEmployeeId,
        leaveMaster: { code: 'COMPOFF' },
        ...(statusFilter ? { status: { in: LEAVE_STATUS_BY_FILTER[statusFilter] ?? [statusFilter] } } : {}),
      },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    leaveAppRows = leaveApps.map((l) => {
      // The Apply-for-Leave calendar (src/app/ess/leave/page.tsx) encodes the
      // worked date as "Worked on YYYY-MM-DD" in reason, since
      // LeaveApplication has no dedicated worked-date column — recovered
      // here so this merged view isn't stuck showing "—" for every request
      // made through that form.
      const match = l.reason?.match(/^Worked on (\d{4}-\d{2}-\d{2})$/);
      return {
        // Offset well clear of CompOffRequest's own id range so the two
        // sources never collide as React/table keys.
        id: 1_000_000 + l.id,
        employeeId: l.employeeId,
        workedDate: match ? new Date(match[1]) : null,
        requestedDate: l.fromDate,
        reason: match ? null : l.reason,
        status: LEAVE_STATUS_TO_COMPOFF[l.status] ?? l.status,
        rejectionReason: null,
        createdAt: l.createdAt,
        employee: l.employee,
      };
    }) as unknown as typeof requestRows;
  }

  const data = [...requestRows, ...leaveAppRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ data, balance });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const workedDate = new Date(parsed.data.workedDate);
  const requestedDate = new Date(parsed.data.requestedDate);

  const freezeErr = await checkMonthNotFrozen(ownEmployeeId, workedDate);
  if (freezeErr) return freezeErr;

  // Validate that the employee has attendance on the worked date with
  // isWeeklyOffWorked or isHolidayWorked = true and OT approved
  const attendance = await prisma.dailyAttendance.findUnique({
    where: {
      employeeId_date: { employeeId: ownEmployeeId, date: workedDate },
    },
  });

  if (!attendance) {
    return NextResponse.json({ error: 'No attendance record found for the worked date' }, { status: 400 });
  }

  if (!attendance.isWeeklyOffWorked && !attendance.isHolidayWorked) {
    return NextResponse.json({ error: 'The worked date was not a weekly off or holiday' }, { status: 400 });
  }

  if (attendance.otApprovalStatus !== 'approved') {
    return NextResponse.json({ error: 'OT for the worked date has not been approved yet' }, { status: 400 });
  }

  if (attendance.otSettlementType === 'COMP_OFF') {
    return NextResponse.json({ error: 'Comp-off was already credited via OT approval. Cannot request again.' }, { status: 400 });
  }

  // Check for duplicate comp-off request for this worked date
  const existing = await prisma.compOffRequest.findFirst({
    where: { employeeId: ownEmployeeId, workedDate, status: { in: ['pending', 'approved'] } },
  });
  if (existing) {
    return NextResponse.json({ error: 'A comp-off request for this worked date already exists' }, { status: 400 });
  }

  const created = await prisma.compOffRequest.create({
    data: {
      employeeId: ownEmployeeId,
      workedDate,
      requestedDate,
      reason: parsed.data.reason ?? null,
      createdByUserId: userId,
    },
  });

  await notifyEssRequest({
    kind: 'COMP_OFF',
    action: 'SUBMITTED',
    employeeId: created.employeeId,
    requestId: created.id,
    period: formatPeriod(created.requestedDate),
    reason: created.reason ?? undefined,
    linkPath: '/workforce/comp-off-request',
  });

  return NextResponse.json(created);
}
