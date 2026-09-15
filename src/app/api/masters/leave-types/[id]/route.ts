/**
 * PUT   /api/masters/leave-types/[id]  — update a leave type.
 * DELETE /api/masters/leave-types/[id] — soft-delete a leave type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const updateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex color like #FF5733').optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.leaveTypeMaster.update({
    where: { id: Number(id) },
    data: {
      ...(parsed.data.code && { code: parsed.data.code }),
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.color && { color: parsed.data.color }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;

  const { id } = await params;
  await prisma.leaveTypeMaster.update({
    where: { id: Number(id) },
    data: { deletedAt: new Date(), isActive: false },
  });
  return NextResponse.json({ deleted: Number(id) });
}
