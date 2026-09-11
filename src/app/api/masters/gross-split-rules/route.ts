/**
 * GET /api/masters/gross-split-rules — Common Logic > Gross % Split.
 *   Returns every active `earning` SalaryComponent in this company's
 *   catalog, each merged with its GrossSplitRule row when one exists (a
 *   component with no rule yet still appears, with percentOfGross: null,
 *   so the page always shows the full component list).
 *
 * PUT /api/masters/gross-split-rules — bulk save. Body: { rules: [{
 *   salaryComponentId, percentOfGross, isActive }] }. Upserts one row per
 *   component in a single transaction — the page always submits its whole
 *   (small, company-scoped) table at once rather than one row at a time.
 *
 * Read-only reference for now — nothing in payroll consumes this yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { grossSplitRuleBulkSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const components = await prisma.salaryComponent.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true, type: 'earning' },
    orderBy: { name: 'asc' },
    include: { grossSplitRule: true },
  });

  const data = components.map((c) => ({
    salaryComponentId: c.id,
    code: c.code,
    name: c.name,
    percentOfGross: c.grossSplitRule?.percentOfGross ?? null,
    isActive: c.grossSplitRule?.isActive ?? true,
    ruleId: c.grossSplitRule?.id ?? null,
  }));

  const total = data.reduce((sum, r) => sum + (r.isActive ? Number(r.percentOfGross ?? 0) : 0), 0);

  return NextResponse.json({ data, totalPercent: Math.round(total * 100) / 100 });
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = grossSplitRuleBulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Every component referenced must belong to this company — otherwise a
  // company admin could write a rule against another tenant's component id.
  const ids = parsed.data.rules.map((r) => r.salaryComponentId);
  const owned = await prisma.salaryComponent.findMany({
    where: { id: { in: ids }, companyId: scope.companyId, deletedAt: null },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));
  const foreign = ids.filter((id) => !ownedIds.has(id));
  if (foreign.length > 0) {
    return NextResponse.json({ error: `Component(s) not found in this company: ${foreign.join(', ')}` }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.rules.map((r) =>
      prisma.grossSplitRule.upsert({
        where: { salaryComponentId: r.salaryComponentId },
        create: { companyId: scope.companyId, salaryComponentId: r.salaryComponentId, percentOfGross: r.percentOfGross, isActive: r.isActive },
        update: { percentOfGross: r.percentOfGross, isActive: r.isActive },
      })
    )
  );

  return NextResponse.json({ message: 'Saved' });
}
