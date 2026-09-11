/**
 * GET/PUT /api/masters/lic-deduction-config
 * Company-scoped single-row config for LIC deduction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const upsertSchema = z.object({
  deductionType: z.enum(['FLAT', 'PERCENT']).default('FLAT'),
  amount: z.coerce.number().min(0),
  minAmount: z.coerce.number().min(0).default(0),
  maxAmount: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const config = await prisma.licDeductionConfig.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const config = await prisma.licDeductionConfig.upsert({
    where: { companyId: scope.companyId },
    create: { companyId: scope.companyId, ...parsed.data, maxAmount: parsed.data.maxAmount ?? null },
    update: { ...parsed.data, maxAmount: parsed.data.maxAmount ?? null },
  });

  return NextResponse.json(config);
}
