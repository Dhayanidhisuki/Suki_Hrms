/**
 * POST /api/payroll/runs/[id]/lock — APPROVED -> LOCKED (final; no
 *      further edits, mirrors Attendance's freeze).
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
  if (run.status !== 'APPROVED') {
    return NextResponse.json({ error: `Cannot lock a run that is ${run.status} — approve it first` }, { status: 409 });
  }

  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'LOCKED', lockedAt: new Date() },
  });

  return NextResponse.json(updated);
}
