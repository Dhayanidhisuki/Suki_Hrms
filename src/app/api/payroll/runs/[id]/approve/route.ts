/**
 * POST /api/payroll/runs/[id]/approve — DRAFT/CALCULATED -> APPROVED.
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
  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (run.status !== 'DRAFT' && run.status !== 'CALCULATED') {
    return NextResponse.json({ error: `Cannot approve a run that is ${run.status}` }, { status: 409 });
  }
  if (run.status === 'DRAFT') {
    return NextResponse.json({ error: 'Calculate the run before approving it' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: userId },
  });

  return NextResponse.json(updated);
}
