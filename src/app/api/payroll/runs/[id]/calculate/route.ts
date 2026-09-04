/**
 * POST /api/payroll/runs/[id]/calculate
 *
 * Runs src/lib/payrollCalculation.ts for every active employee in this
 * company. Safe to call repeatedly while DRAFT/CALCULATED — replaces
 * system-generated line items, preserves ad-hoc ones. Blocked once
 * APPROVED/LOCKED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkPayrollRunEditable } from '@/lib/payrollGuard';
import { calculatePayrollRun } from '@/lib/payrollCalculation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const editableErr = await checkPayrollRunEditable(runId);
  if (editableErr) return editableErr;

  const result = await calculatePayrollRun(runId);

  return NextResponse.json({
    message: `Calculated ${result.calculated} employee(s)${result.onHold ? `, ${result.onHold} on hold` : ''}`,
    ...result,
  });
}
