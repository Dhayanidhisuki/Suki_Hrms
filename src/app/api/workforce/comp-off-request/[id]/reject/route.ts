/**
 * POST /api/workforce/comp-off-request/[id]/reject
 *   — reject a comp-off request. Body: { rejectionReason? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const reqId = Number(id);
  const req = await prisma.compOffRequest.findUnique({
    where: { id: reqId },
    include: { employee: { select: { companyId: true } } },
  });
  if (!req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (req.employee.companyId !== scope.companyId) {
    return NextResponse.json({ error: 'Not in your company' }, { status: 403 });
  }
  if (req.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const rejectionReason = body?.rejectionReason ?? null;

  const updated = await prisma.compOffRequest.update({
    where: { id: reqId },
    data: {
      status: 'rejected',
      rejectionReason,
      rejectedByUserId: userId,
      rejectedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
