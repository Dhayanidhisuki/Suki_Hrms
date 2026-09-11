/**
 * GET  /api/masters/attendance-color-config
 * POST /api/masters/attendance-color-config
 *   Company-scoped single-row config for attendance grid color thresholds.
 *   GET returns the config (or defaults if none exists).
 *   POST creates or updates (upsert) the config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const configSchema = z.object({
  zeroHoursColor: z.string().max(10).default('#ef4444'),
  shortHoursColor: z.string().max(10).default('#f97316'),
  shortHoursThreshold: z.coerce.number().int().min(0).max(24).default(4),
  partialHoursColor: z.string().max(10).default('#eab308'),
  partialHoursThreshold: z.coerce.number().int().min(0).max(24).default(6),
  normalHoursColor: z.string().max(10).default('#22c55e'),
  normalHoursThreshold: z.coerce.number().int().min(0).max(24).default(8),
  extendedHoursColor: z.string().max(10).default('#15803d'),
  weeklyOffColor: z.string().max(10).default('#3b82f6'),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const config = await prisma.attendanceColorConfig.findUnique({
    where: { companyId: scope.companyId },
  });

  // Return defaults if no config exists.
  const defaults = configSchema.parse({});
  return NextResponse.json(config ?? { companyId: scope.companyId, ...defaults });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = configSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.attendanceColorConfig.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
