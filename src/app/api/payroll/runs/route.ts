/**
 * GET  /api/payroll/runs           — list this company's payroll runs
 * POST /api/payroll/runs           — create a run for a year+month (DRAFT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { createPayrollRunSchema } from '@/lib/validations/payroll';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const runs = await prisma.payrollRun.findMany({
    where: { companyId: scope.companyId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { _count: { select: { lines: true } } },
  });

  return NextResponse.json({ data: runs });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = createPayrollRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.payrollRun.findUnique({
    where: { companyId_year_month: { companyId: scope.companyId, year: parsed.data.year, month: parsed.data.month } },
  });
  if (existing) {
    return NextResponse.json({ error: 'A payroll run already exists for this period', run: existing }, { status: 409 });
  }

  const run = await prisma.payrollRun.create({
    data: { companyId: scope.companyId, year: parsed.data.year, month: parsed.data.month },
  });

  return NextResponse.json(run, { status: 201 });
}
