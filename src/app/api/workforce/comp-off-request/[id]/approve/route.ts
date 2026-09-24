/**
 * POST /api/workforce/comp-off-request/[id]/approve
 *   — approve a comp-off request. Credits 1 comp-off day to the employee's
 *   leave balance and marks the request as approved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { creditCompOff } from '@/lib/compOffTransactions';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

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

  // Credit 1 comp-off day to the employee's leave balance
  await creditCompOff(req.employeeId, 1, req.requestedDate, 'COMP_OFF_REQUEST', reqId, `Comp-off request approved for working on ${req.workedDate.toISOString().slice(0, 10)}`);

  const updated = await prisma.compOffRequest.update({
    where: { id: reqId },
    data: {
      status: 'approved',
      approvedByUserId: userId,
      approvedAt: new Date(),
    },
  });

  await notifyEssRequest({
    companyId: scope.companyId,
    kind: 'COMP_OFF',
    action: 'APPROVED',
    employeeId: req.employeeId,
    requestId: reqId,
    period: formatPeriod(req.requestedDate),
    reason: req.reason ?? undefined,
    linkPath: '/ess/comp-off',
  });

  return NextResponse.json(updated);
}
