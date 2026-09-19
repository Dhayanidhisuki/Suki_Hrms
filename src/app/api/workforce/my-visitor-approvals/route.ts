/**
 * GET /api/workforce/my-visitor-approvals
 *
 * Get pending visitor pass approvals for the logged-in employee
 * (passes where they are the person to meet).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  try {
    const data = await prisma.visitorGatePass.findMany({
      where: {
        personToMeetId: employeeId,
        status: 'PENDING_APPROVAL',
        companyId: scope.companyId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch visitor approvals' }, { status: 500 });
  }
}
