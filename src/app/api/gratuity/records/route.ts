/**
 * GET  /api/gratuity/records — this company's gratuity records.
 * POST /api/gratuity/records — body { employeeId }. Calculates gratuity for
 *      one employee's recorded separation (404 if none exists, 409 if a
 *      record already exists and isn't recalculable — see
 *      src/lib/gratuityCalculation.ts). Per-employee, not a year-batch like
 *      Bonus's Calculate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { calculateGratuitySchema } from '@/lib/validations/gratuity';
import { calculateGratuity } from '@/lib/gratuityCalculation';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.gratuity.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const data = await prisma.gratuityRecord.findMany({
    where: { companyId: scope.companyId, ...(status ? { status } : {}) },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            select: { department: { select: { name: true } }, designation: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.gratuity.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = calculateGratuitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await findEmployeeInCompany(parsed.data.employeeId, scope.companyId);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  try {
    const record = await calculateGratuity(scope.companyId, employee.id);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('no recorded separation')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('Cannot recalculate')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
