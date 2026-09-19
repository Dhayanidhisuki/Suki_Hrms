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
import { salaryComponentSchema, normalizeSalaryComponentFlags } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const grossTier = searchParams.get('grossTier');
  // Every picker (Salary Details, Payslip ad-hoc, Salary Revision…) wants
  // active-only, the default. Only the Salary Components admin page itself
  // opts into seeing inactive rows too, so its eye-icon toggle doesn't make
  // a component vanish from the list — it just flips the Status badge.
  const includeInactive = searchParams.get('includeInactive') === 'true';
  // Soft-deleted rows still occupy their `code` under the companyId+code
  // unique constraint, so the Salary Components admin page also needs to
  // see them (filtered back out client-side before rendering) when it picks
  // the next auto-generated code — otherwise it can reissue an already-used
  // code and the create fails with a raw Prisma P2002.
  const includeDeleted = searchParams.get('includeDeleted') === 'true';

  const rows = await prisma.salaryComponent.findMany({
    where: { companyId: scope.companyId, ...(includeDeleted ? {} : { deletedAt: null }), ...(includeInactive ? {} : { isActive: true }), ...(type ? { type } : {}), ...(grossTier ? { grossTier } : {}) },
    orderBy: { name: 'asc' },
    include: { grossSplitRule: { select: { percentOfGross: true } } },
  });
  const data = rows.map((r) => ({
    ...r,
    percentOfGross: r.type === 'earning' && r.grossTier === 'FIXED' ? (r.grossSplitRule?.percentOfGross ?? null) : null,
    grossSplitRule: undefined,
  }));

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

  const { percentOfGross, ...componentData } = normalizeSalaryComponentFlags(parsed.data);
  const record = await prisma.salaryComponent.create({
    data: { ...componentData, companyId: scope.companyId },
  });

  // Percentage of Gross only ever applies to Fixed-tier earning components
  // (Basic, HRA, LTA…) — Additional/Non-Payroll components are always
  // manually entered, so a submitted percentage is silently ignored for them.
  const appliesPercent = componentData.type === 'earning' && componentData.grossTier === 'FIXED';
  if (appliesPercent && percentOfGross !== null && percentOfGross !== undefined) {
    await prisma.grossSplitRule.upsert({
      where: { salaryComponentId: record.id },
      create: { companyId: scope.companyId, salaryComponentId: record.id, percentOfGross, isActive: true },
      update: { percentOfGross },
    });
  }

  return NextResponse.json({ ...record, percentOfGross: appliesPercent ? (percentOfGross ?? null) : null }, { status: 201 });
}
