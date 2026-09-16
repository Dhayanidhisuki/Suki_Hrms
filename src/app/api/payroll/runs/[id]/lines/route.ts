/**
 * POST /api/payroll/runs/[id]/lines
 *
 * Add an individual employee to a payroll run. Creates an empty
 * PayrollLine (if one doesn't already exist) and triggers a full
 * calculation so the line gets populated with the right values.
 *
 * Body: { employeeId: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculatePayrollRun } from '@/lib/payrollCalculation';
import { z } from 'zod';

const bodySchema = z.object({ employeeId: z.number().int().positive() });

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
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.status === 'LOCKED' || run.status === 'POSTED') {
    return NextResponse.json({ error: `Run is ${run.status} — cannot add` }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Verify employee belongs to this company
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
  }

  // Check if already in the run
  const existing = await prisma.payrollLine.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId: runId, employeeId: parsed.data.employeeId } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Employee already in this run', line: existing }, { status: 409 });
  }

  // Create empty line
  const line = await prisma.payrollLine.create({
    data: {
      payrollRunId: runId,
      employeeId: parsed.data.employeeId,
      totalWorkingDays: new Date(run.year, run.month, 0).getDate(),
      payableDays: 0,
      status: 'OK',
    },
  });

  // Recalculate the whole run to populate values
  await calculatePayrollRun(runId);

  return NextResponse.json({
    message: `${employee.employeeCode} added to run`,
    lineId: line.id,
  });
}
