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
import { creditCompOff } from '@/lib/compOffTransactions';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');

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

  if (!isHr) {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    where.employeeId = ownEmployeeId;
  }

  if (statusFilter) where.status = statusFilter;

  const data = await prisma.compOffRequest.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
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
    linkPath: '/ess/comp-off',
  });

  return NextResponse.json(created);
}
