/**
 * GET  /api/payroll/tds/declarations?employeeId=X&financialYear=YYYY
 *   Returns declarations for an employee (or all for the company).
 * POST /api/payroll/tds/declarations
 *   Creates a new investment declaration for the logged-in employee
 *   (or on behalf of an employee by HR).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { tdsInvestmentDeclarationSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const financialYear = searchParams.get('financialYear');

  const where: Record<string, unknown> = { companyId: scope.companyId };
  if (employeeId) where.employeeId = Number(employeeId);
  if (financialYear) where.financialYear = Number(financialYear);

  const data = await prisma.tdsInvestmentDeclaration.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      proofs: true,
    },
    orderBy: [{ financialYear: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = tdsInvestmentDeclarationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const record = await prisma.tdsInvestmentDeclaration.create({
    data: {
      ...parsed.data,
      employeeId: Number(employeeId),
      companyId: scope.companyId,
    },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json(record, { status: 201 });
}
