import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { allowanceConfigSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const data = await prisma.allowanceConfig.findMany({
    where: { companyId: scope.companyId },
    orderBy: [{ componentCode: 'asc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = allowanceConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const record = await prisma.allowanceConfig.create({
    data: { ...parsed.data, companyId: scope.companyId, eligibilityValue: parsed.data.eligibilityValue ?? null },
  });
  return NextResponse.json(record, { status: 201 });
}
