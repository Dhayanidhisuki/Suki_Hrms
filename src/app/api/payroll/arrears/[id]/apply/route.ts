/**
 * POST /api/payroll/arrears/[id]/apply — body { payrollRunId }. Pushes the
 * arrear into that run as ad-hoc PayrollLineComponent rows. Guards: arrear
 * not already APPLIED, target run editable (checkPayrollRunEditable), and a
 * PayrollLine already exists there for this employee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { applyArrearSchema } from '@/lib/validations/payroll';
import { applyArrearToPayroll } from '@/lib/arrearApply';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const parsed = applyArrearSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salaryArrear.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const targetRun = await prisma.payrollRun.findFirst({
    where: { id: parsed.data.payrollRunId, companyId: scope.companyId },
  });
  if (!targetRun) return NextResponse.json({ error: 'Target payroll run not found' }, { status: 404 });

  try {
    await applyArrearToPayroll(record.id, parsed.data.payrollRunId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const updated = await prisma.salaryArrear.findUnique({ where: { id: record.id } });
  return NextResponse.json(updated);
}
