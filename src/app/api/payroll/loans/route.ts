/**
 * GET  /api/payroll/loans?employeeId=X&status=X
 *   List loans for the company (optionally filtered by employee or status).
 * POST /api/payroll/loans
 *   Create a new loan (status=pending). Validates against LoanType min/max.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { loanSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { companyId: scope.companyId };
  if (employeeId) where.employeeId = Number(employeeId);
  if (status) where.status = status;

  const data = await prisma.loan.findMany({
    where,
    include: {
      employee: { select: { id: true, oldEmployeeCode: true, firstName: true, lastName: true } },
      loanType: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = loanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Validate LoanType min/max.
  const loanType = await prisma.loanType.findUnique({ where: { id: parsed.data.loanTypeId } });
  if (!loanType || !loanType.isActive) {
    return NextResponse.json({ error: 'Invalid loan type' }, { status: 400 });
  }
  if (loanType.minAmount && parsed.data.principal < Number(loanType.minAmount)) {
    return NextResponse.json({ error: `Principal below minimum (${loanType.minAmount}) for this loan type` }, { status: 400 });
  }
  if (loanType.maxAmount && parsed.data.principal > Number(loanType.maxAmount)) {
    return NextResponse.json({ error: `Principal exceeds maximum (${loanType.maxAmount}) for this loan type` }, { status: 400 });
  }

  // Validate employee belongs to this company.
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found in this company' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const record = await prisma.loan.create({
    data: {
      ...parsed.data,
      companyId: scope.companyId,
      outstandingBalance: parsed.data.principal,
      firstDeductionMonth: parsed.data.firstDeductionMonth ?? null,
      firstDeductionYear: parsed.data.firstDeductionYear ?? null,
      remarks: parsed.data.remarks ?? null,
      status: 'pending',
      requestedByUserId: userId,
    },
    include: {
      employee: { select: { oldEmployeeCode: true, firstName: true, lastName: true } },
      loanType: { select: { code: true, name: true } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
