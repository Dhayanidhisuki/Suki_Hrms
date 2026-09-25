/**
 * GET /api/workforce/comp-off-eligible-dates
 *   — dates the caller worked a weekly-off/holiday with approved OT that
 *   hasn't been settled as comp-off or already claimed via a pending/approved
 *   CompOffRequest. Used to restrict the Comp-Off "date worked" picker to
 *   only dates that are actually eligible, per the same rules enforced by
 *   POST /api/workforce/comp-off-request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const scope = getCompanyId(request);
  const policy = 'error' in scope
    ? null
    : await prisma.compOffPolicy.findUnique({ where: { companyId: scope.companyId } });
  // 0 or no policy row = never expires — the "off" date picker has no upper bound.
  const expiryMonths = policy && policy.isActive ? policy.expiryMonths : 0;

  // OT-eligible employees are paid overtime, not Comp-Off — same split
  // enforced when OT is settled (attendance/ot/[id]/approve).
  const jobInfo = await prisma.jobInfo.findFirst({ where: { employeeId: ownEmployeeId, effectiveTo: null }, select: { overtimeAllowed: true } });
  if (jobInfo?.overtimeAllowed) {
    return NextResponse.json({ dates: [], expiryMonths });
  }

  const [attendanceRows, claimedRows] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: {
        employeeId: ownEmployeeId,
        OR: [{ isWeeklyOffWorked: true }, { isHolidayWorked: true }],
        otApprovalStatus: 'approved',
        otSettlementType: { not: 'COMP_OFF' },
      },
      select: { date: true },
    }),
    prisma.compOffRequest.findMany({
      where: { employeeId: ownEmployeeId, status: { in: ['pending', 'approved'] } },
      select: { workedDate: true },
    }),
  ]);

  const claimed = new Set(claimedRows.map((r) => r.workedDate.toISOString().slice(0, 10)));
  const dates = attendanceRows
    .map((r) => r.date.toISOString().slice(0, 10))
    .filter((d) => !claimed.has(d));

  return NextResponse.json({ dates, expiryMonths });
}
