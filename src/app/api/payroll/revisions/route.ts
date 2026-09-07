/**
 * GET  /api/payroll/revisions  — list this company's revision requests
 *                                 (optional ?status=, ?employeeId= filters)
 * POST /api/payroll/revisions  — create a DRAFT (or SUBMITTED, if
 *                                 body.submit is true) revision request.
 *                                 Server computes whichever of
 *                                 incrementAmount/incrementPercent/
 *                                 revisedGross wasn't the direct input.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { createSalaryRevisionRequestSchema } from '@/lib/validations/payroll';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const employeeId = searchParams.get('employeeId');

  const data = await prisma.salaryRevisionRequest.findMany({
    where: {
      companyId: scope.companyId,
      ...(status ? { status } : {}),
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      arrear: { select: { id: true, status: true, netArrearTotal: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const parsed = createSalaryRevisionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const employee = await findEmployeeInCompany(data.employeeId, scope.companyId);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const currentRevision = await prisma.employeeSalaryRevision.findFirst({
    where: { employeeId: data.employeeId, effectiveTo: null },
    include: { components: true },
  });
  if (!currentRevision) {
    return NextResponse.json({ error: 'This employee has no current salary structure to revise.' }, { status: 400 });
  }
  const currentGross = Number(currentRevision.grossSalary);

  let incrementAmount: number;
  let incrementPercent: number;
  let revisedGross: number;
  if (data.revisionMethod === 'PERCENTAGE') {
    incrementPercent = data.incrementPercent!;
    incrementAmount = Math.round(currentGross * (incrementPercent / 100));
    revisedGross = currentGross + incrementAmount;
  } else if (data.revisionMethod === 'FIXED_AMOUNT') {
    incrementAmount = data.incrementAmount!;
    revisedGross = currentGross + incrementAmount;
    incrementPercent = currentGross > 0 ? Number(((incrementAmount / currentGross) * 100).toFixed(2)) : 0;
  } else {
    revisedGross = data.revisedGross!;
    incrementAmount = revisedGross - currentGross;
    incrementPercent = currentGross > 0 ? Number(((incrementAmount / currentGross) * 100).toFixed(2)) : 0;
  }

  if (data.components.length > 0) {
    const validCount = await prisma.salaryComponent.count({
      where: { id: { in: data.components.map((c) => c.salaryComponentId) }, companyId: scope.companyId },
    });
    if (validCount !== new Set(data.components.map((c) => c.salaryComponentId)).size) {
      return NextResponse.json({ error: 'One or more salary components do not belong to this company.' }, { status: 400 });
    }
  }

  const currentByComponent = new Map(currentRevision.components.map((c) => [c.salaryComponentId, Number(c.amount)]));
  const components = data.components.map((c) => ({
    salaryComponentId: c.salaryComponentId,
    currentAmount: currentByComponent.get(c.salaryComponentId) ?? 0,
    revisedAmount: c.revisedAmount,
  }));

  const created = await prisma.salaryRevisionRequest.create({
    data: {
      companyId: scope.companyId,
      employeeId: data.employeeId,
      revisionType: data.revisionType,
      revisionMethod: data.revisionMethod,
      currentGross,
      incrementPercent,
      incrementAmount,
      revisedGross,
      effectiveFrom: data.effectiveFrom,
      remarks: data.remarks ?? null,
      status: data.submit ? 'SUBMITTED' : 'DRAFT',
      createdByUserId: performedByUserId,
      components: { create: components },
    },
    include: { components: true },
  });

  return NextResponse.json(created, { status: 201 });
}
