/**
 * GET /api/workforce/my-leave/types
 *   Active leave types available for self-service application. Any
 *   authenticated employee may view this catalog.
 *
 *   Compensatory Off is excluded for OT-eligible employees — they're paid
 *   overtime instead, so Comp-Off is reserved for employees whose current
 *   JobInfo has overtimeAllowed=false. Mirrors the same split
 *   /api/workforce/attendance/ot/[id]/approve enforces when settling OT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  const jobInfo = ownEmployeeId
    ? await prisma.jobInfo.findFirst({ where: { employeeId: ownEmployeeId, effectiveTo: null }, select: { overtimeAllowed: true } })
    : null;
  const otEligible = jobInfo?.overtimeAllowed ?? false;

  const types = await prisma.leaveMaster.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(otEligible ? { code: { not: 'COMPOFF' } } : {}),
    },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: types });
}
