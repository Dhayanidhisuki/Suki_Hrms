/**
 * GET  /api/masters/leave-types
 *   — list leave type masters for this company.
 * POST /api/masters/leave-types
 *   — create a leave type. Body: { code, name, color, description? }
 * PUT  /api/masters/leave-types/[id]
 *   — update a leave type.
 * DELETE /api/masters/leave-types/[id]
 *   — soft-delete a leave type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const data = await prisma.leaveTypeMaster.findMany({
    where: { companyId: scope.companyId, deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return NextResponse.json({ data });
}

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex color like #FF5733'),
  description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const created = await prisma.leaveTypeMaster.create({
    data: {
      companyId: scope.companyId,
      code: parsed.data.code,
      name: parsed.data.name,
      color: parsed.data.color,
      description: parsed.data.description ?? null,
    },
  });
  return NextResponse.json(created);
}
