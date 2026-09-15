/**
 * POST /api/workforce/shift-change-request/[id]/reject  { rejectionReason }
 *   — rejects a shift change request at the current stage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { checkSpecificPermission } from '@/lib/rbac-employee';

const bodySchema = z.object({ rejectionReason: z.string().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const reqId = Number(id);
  const req = await prisma.shiftChangeRequest.findUnique({
    where: { id: reqId },
    include: { employee: { select: { companyId: true, reportingManagerId: true } } },
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

  // Check permission: same as approve
  const chainConfigs = await prisma.approvalChainConfig.findMany({
    where: { companyId: scope.companyId, module: 'SHIFT_CHANGE', isActive: true },
    orderBy: { stageOrder: 'asc' },
  });
  const currentStage = chainConfigs.find((c) => c.stageOrder === req.currentStageOrder);
  if (currentStage) {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (currentStage.approverType === 'REPORTING_MANAGER') {
      if (req.employee.reportingManagerId !== ownEmployeeId) {
        return NextResponse.json({ error: 'Only the reporting manager can reject this stage' }, { status: 403 });
      }
    } else if (currentStage.approverType === 'HR') {
      const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
      if (permErr) return permErr;
    } else if (currentStage.approverType === 'SPECIFIC_USER') {
      if (currentStage.approverUserId !== userId) {
        return NextResponse.json({ error: 'You are not the designated approver for this stage' }, { status: 403 });
      }
    }
  }

  const updated = await prisma.shiftChangeRequest.update({
    where: { id: reqId },
    data: {
      status: 'rejected',
      rejectionReason: parsed.data.rejectionReason,
      rejectedByUserId: userId,
      rejectedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
