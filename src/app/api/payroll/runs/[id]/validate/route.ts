/**
 * POST /api/payroll/runs/[id]/validate — CALCULATED -> VALIDATED.
 *
 * Optional stage enabled by PayrollWorkflowConfig.enableValidatedStage.
 * Runs pre-validation and marks the run as VALIDATED if no ERROR-severity
 * issues exist (HOLD lines are allowed — they're flagged for review).
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
  if (run.status !== 'CALCULATED') {
    return NextResponse.json({ error: `Run must be CALCULATED (current: ${run.status})` }, { status: 409 });
  }

  // Check if validation stage is enabled.
  const workflowConfig = await prisma.payrollWorkflowConfig.findUnique({ where: { companyId: scope.companyId } });
  if (workflowConfig && !workflowConfig.enableValidatedStage) {
    return NextResponse.json({ error: 'Validation stage is not enabled for this company' }, { status: 400 });
  }

  // Run pre-validation to check for ERROR-severity issues.
  const preValRes = await fetch(new URL(`/api/payroll/runs/${runId}/pre-validation`, request.url), {
    headers: { 'x-user-id': request.headers.get('x-user-id') ?? '' },
  });
  if (preValRes.ok) {
    const preVal = await preValRes.json();
    if (preVal.holdCount > 0) {
      return NextResponse.json({
        error: `${preVal.holdCount} line(s) have validation errors. Resolve HOLD lines before validating.`,
        holdCount: preVal.holdCount,
      }, { status: 409 });
    }
  }

  const userId = Number(request.headers.get('x-user-id'));
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'VALIDATED', validatedAt: new Date(), validatedByUserId: userId },
  });

  return NextResponse.json(updated);
}
