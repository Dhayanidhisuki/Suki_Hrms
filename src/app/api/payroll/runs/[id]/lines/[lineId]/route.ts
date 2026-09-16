/**
 * GET    /api/payroll/runs/[id]/lines/[lineId] — one employee's full itemized
 *                                               line (the payslip's data source).
 * PATCH  /api/payroll/runs/[id]/lines/[lineId] — inline-edit money fields.
 * DELETE /api/payroll/runs/[id]/lines/[lineId] — remove employee from run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

async function loadLine(runId: number, lineId: number, companyId: number) {
  return prisma.payrollLine.findFirst({
    where: { id: lineId, payrollRunId: runId, payrollRun: { companyId } },
    include: { payrollRun: { select: { status: true } } },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id, lineId } = await params;

  const line = await prisma.payrollLine.findFirst({
    where: {
      id: parseInt(lineId),
      payrollRunId: parseInt(id),
      payrollRun: { companyId: scope.companyId },
    },
    include: {
      payrollRun: { select: { year: true, month: true, status: true } },
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      components: { include: { salaryComponent: { select: { code: true, name: true, type: true, grossTier: true, includeInGross: true } } } },
    },
  });
  if (!line) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(line);
}

const EDITABLE_FIELDS = [
  'grossEarnings', 'otAmount', 'otherEarningsTotal',
  'pfEmployee', 'esiEmployee', 'professionalTax', 'tds',
  'otherDeductionsTotal', 'lomAmount', 'lwfAmount',
  'healthInsurance', 'licAmount', 'netSalary',
  'payableDays', 'lopDays',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id, lineId } = await params;
  const runId = parseInt(id);
  const lineIdNum = parseInt(lineId);

  const line = await loadLine(runId, lineIdNum, scope.companyId);
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (line.payrollRun.status === 'LOCKED' || line.payrollRun.status === 'POSTED') {
    return NextResponse.json({ error: `Run is ${line.payrollRun.status} — cannot edit` }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Pick only editable fields from the body
  const updateData: Record<string, number> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      const val = Number(body[field]);
      if (!isNaN(val)) updateData[field] = val;
    }
  }

  // Also allow status/holdReason changes via PATCH
  if ('status' in body && typeof body.status === 'string') {
    updateData.status = body.status;
    updateData.holdReason = body.holdReason ?? null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  // Recalculate netSalary if component fields changed but netSalary wasn't explicitly set
  if (!('netSalary' in updateData)) {
    const updated = { ...line, ...updateData } as any;
    const totalDeductions =
      Number(updated.pfEmployee) + Number(updated.esiEmployee) +
      Number(updated.professionalTax) + Number(updated.tds) +
      Number(updated.otherDeductionsTotal);
    updateData.netSalary =
      Number(updated.grossEarnings) + Number(updated.otAmount) + Number(updated.otherEarningsTotal) - totalDeductions;
  }

  const updated = await prisma.payrollLine.update({
    where: { id: lineIdNum },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id, lineId } = await params;
  const runId = parseInt(id);
  const lineIdNum = parseInt(lineId);

  const line = await loadLine(runId, lineIdNum, scope.companyId);
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (line.payrollRun.status === 'LOCKED' || line.payrollRun.status === 'POSTED') {
    return NextResponse.json({ error: `Run is ${line.payrollRun.status} — cannot delete` }, { status: 409 });
  }

  // Delete components first (cascade may not be set in Prisma schema)
  await prisma.payrollLineComponent.deleteMany({ where: { payrollLineId: lineIdNum } });
  await prisma.payrollLine.delete({ where: { id: lineIdNum } });

  return NextResponse.json({ message: 'Employee removed from run' });
}
