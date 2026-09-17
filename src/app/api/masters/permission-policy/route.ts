/**
 * GET  /api/masters/permission-policy — this company's permission policy.
 * PUT  /api/masters/permission-policy — upsert it.
 *
 * Company-scoped single-row config (companyId @unique). freeHoursPerMonth is
 * the monthly pool an employee may take as short leave, consumed in whatever
 * splits they like — 30 minutes one day, an hour the next — until it runs
 * out. Hours beyond the pool are flagged for HR, never auto-deducted (BRD:
 * "Excess hours flagged but not deducted. No salary impact.").
 *
 * Until this row exists the engine falls back to a hardcoded 2 hours, which
 * no one could change without editing the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';

const DEFAULTS = { freeHoursPerMonth: 2 };

const schema = z.object({
  // Quarter-hour granularity so a policy can be expressed the way it is
  // actually written ("4 hours", "2.5 hours") without inviting 1.37.
  freeHoursPerMonth: z.coerce
    .number()
    .min(0)
    .max(99)
    .refine((v) => Math.round(v * 4) === v * 4, 'Use quarter-hour steps (e.g. 2, 2.5, 4)'),
});

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.permissionPolicy.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(
    record ? { ...record, freeHoursPerMonth: Number(record.freeHoursPerMonth) } : DEFAULTS
  );
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.permissionPolicy.upsert({
    where: { companyId: scope.companyId },
    create: { companyId: scope.companyId, freeHoursPerMonth: parsed.data.freeHoursPerMonth },
    update: { freeHoursPerMonth: parsed.data.freeHoursPerMonth },
  });

  return NextResponse.json({ ...record, freeHoursPerMonth: Number(record.freeHoursPerMonth) });
}
