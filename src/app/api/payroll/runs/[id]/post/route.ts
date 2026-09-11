/**
 * POST /api/payroll/runs/[id]/post — LOCKED -> POSTED.
 *
 * Optional final stage enabled by PayrollWorkflowConfig.enablePostedStage.
 * Marks the run as POSTED — accounting entries are finalized, no further
 * changes possible. This is the terminal status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.status !== 'LOCKED') {
    return NextResponse.json({ error: `Run must be LOCKED (current: ${run.status})` }, { status: 409 });
  }

  const workflowConfig = await prisma.payrollWorkflowConfig.findUnique({ where: { companyId: scope.companyId } });
  if (workflowConfig && !workflowConfig.enablePostedStage) {
    return NextResponse.json({ error: 'Post stage is not enabled for this company' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'POSTED', postedAt: new Date(), postedByUserId: userId },
  });

  return NextResponse.json(updated);
}
