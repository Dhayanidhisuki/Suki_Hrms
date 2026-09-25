/**
 * GET /api/workforce/my-leave/preview?leaveMasterId&from&to&isHalfDay
 *
 * What a leave for these dates would cost the logged-in employee, before
 * they submit: working days counted, weekly offs / holidays skipped,
 * sandwiched days (unpaid types), and dates that already carry a punch.
 * Same computation the submit and approve paths use (computeLeaveDays), so
 * the number shown is the number debited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { computeLeaveDays } from '@/lib/leave/leaveDays';
import { planSummary } from '@/lib/leave/submission';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });

  const q = request.nextUrl.searchParams;
  const leaveMasterId = Number(q.get('leaveMasterId'));
  const from = q.get('from');
  const to = q.get('to') ?? from;
  const isHalfDay = q.get('isHalfDay') === 'true';
  if (!leaveMasterId || !from || !to) return NextResponse.json({ error: 'leaveMasterId, from and to are required' }, { status: 400 });

  const [employee, leaveMaster] = await Promise.all([
    prisma.employee.findUnique({ where: { id: ownEmployeeId }, select: { companyId: true } }),
    prisma.leaveMaster.findFirst({ where: { id: leaveMasterId, isActive: true, deletedAt: null }, select: { isPaid: true, countSandwichedNonWorking: true } }),
  ]);
  if (!employee || !leaveMaster) return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 });

  const plan = await computeLeaveDays({
    companyId: employee.companyId,
    employeeId: ownEmployeeId,
    leaveMaster,
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T00:00:00.000Z`),
    isHalfDay,
  });
  return NextResponse.json(planSummary(plan));
}
