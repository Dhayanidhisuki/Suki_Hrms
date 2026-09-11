import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { incentivePolicySchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const data = await prisma.incentivePolicy.findMany({
    where: { companyId: scope.companyId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = incentivePolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const record = await prisma.incentivePolicy.create({
    data: { ...parsed.data, companyId: scope.companyId, formula: parsed.data.formula ?? null, eligibility: parsed.data.eligibility ?? null, eligibleShiftCodes: parsed.data.eligibleShiftCodes ?? null },
  });
  return NextResponse.json(record, { status: 201 });
}
