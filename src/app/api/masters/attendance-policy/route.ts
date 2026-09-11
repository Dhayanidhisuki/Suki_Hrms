/**
 * GET/PUT /api/masters/attendance-policy
 * Company-scoped single-row config for attendance policy (break rules,
 * grace periods, half-day rules).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const upsertSchema = z.object({
  breakMinutesPerDay: z.coerce.number().int().min(0).default(30),
  breakDeductible: z.boolean().default(false),
  lateGraceMinutes: z.coerce.number().int().min(0).default(0),
  earlyOutGraceMinutes: z.coerce.number().int().min(0).default(0),
  halfDayMinHours: z.coerce.number().int().min(0).optional().nullable(),
  halfDayMaxHours: z.coerce.number().int().min(0).optional().nullable(),
  minFullDayHours: z.coerce.number().int().min(1).default(8),
  autoAbsentIfNoPunch: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const config = await prisma.attendancePolicy.findUnique({ where: { companyId: scope.companyId } });
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

  const config = await prisma.attendancePolicy.upsert({
    where: { companyId: scope.companyId },
    create: { companyId: scope.companyId, ...parsed.data, halfDayMinHours: parsed.data.halfDayMinHours ?? null, halfDayMaxHours: parsed.data.halfDayMaxHours ?? null },
    update: { ...parsed.data, halfDayMinHours: parsed.data.halfDayMinHours ?? null, halfDayMaxHours: parsed.data.halfDayMaxHours ?? null },
  });

  return NextResponse.json(config);
}
