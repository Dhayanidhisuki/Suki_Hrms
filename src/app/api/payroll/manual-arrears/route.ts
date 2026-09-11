/**
 * GET  /api/payroll/manual-arrears
 * POST /api/payroll/manual-arrears
 *
 * List and create manual arrears (ALLOWANCE, DEDUCTION_REVERSAL,
 * ATTENDANCE, INCENTIVE, MANUAL — BRD §5).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

const createSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  arrearType: z.enum(['ALLOWANCE', 'DEDUCTION_REVERSAL', 'ATTENDANCE', 'INCENTIVE', 'MANUAL']),
  amountType: z.enum(['EARNING', 'DEDUCTION']).default('EARNING'),
  amount: z.coerce.number().min(0.01),
  arrearYear: z.coerce.number().int().min(2000).max(2100),
  arrearMonth: z.coerce.number().int().min(1).max(12),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const where: Record<string, unknown> = { companyId: scope.companyId };
  if (status) where.status = status;

  const data = await prisma.manualArrear.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await findEmployeeInCompany(parsed.data.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const record = await prisma.manualArrear.create({
    data: {
      ...parsed.data,
      companyId: scope.companyId,
      description: parsed.data.description ?? null,
      createdByUserId: userId,
    },
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
