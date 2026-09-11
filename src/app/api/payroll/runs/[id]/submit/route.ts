/**
 * POST /api/payroll/runs/[id]/submit — VALIDATED/CALCULATED -> SUBMITTED.
 *
 * Optional stage enabled by PayrollWorkflowConfig.enableSubmittedStage.
 * Signals that the payroll run is ready for approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Accept from CALCULATED or VALIDATED (if validation stage is enabled).
  if (run.status !== 'CALCULATED' && run.status !== 'VALIDATED') {
    return NextResponse.json({ error: `Run must be CALCULATED or VALIDATED (current: ${run.status})` }, { status: 409 });
  }

  const workflowConfig = await prisma.payrollWorkflowConfig.findUnique({ where: { companyId: scope.companyId } });
  if (workflowConfig && !workflowConfig.enableSubmittedStage) {
    return NextResponse.json({ error: 'Submit stage is not enabled for this company' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'SUBMITTED', submittedAt: new Date(), submittedByUserId: userId },
  });

  return NextResponse.json(updated);
}
