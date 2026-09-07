/**
 * GET  /api/masters/salary-components — this company's SalaryComponent
 *      catalog, used to populate the Salary Details / Payslip ad-hoc /
 *      Salary Revision component pickers.
 * POST /api/masters/salary-components — add a custom component to this
 *      company's catalog (migration 000012 made the catalog company-scoped;
 *      previously this was read-only, managed only by a seed script).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { salaryComponentSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const data = await prisma.salaryComponent.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true, ...(type ? { type } : {}) },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = salaryComponentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.salaryComponent.findUnique({
    where: { companyId_code: { companyId: scope.companyId, code: parsed.data.code } },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
  }

  const record = await prisma.salaryComponent.create({
    data: { ...parsed.data, companyId: scope.companyId },
  });
  return NextResponse.json(record, { status: 201 });
}
