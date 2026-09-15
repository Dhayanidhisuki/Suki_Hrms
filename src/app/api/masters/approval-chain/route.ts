/**
 * GET  /api/masters/approval-chain
 *   — list approval chain configs for this company.
 *   ?module=SHIFT_CHANGE (optional filter)
 * POST /api/masters/approval-chain
 *   — create or update an approval chain stage.
 *   Body: { module, stageName, stageOrder, approverType, approverRoleId?, approverUserId? }
 * DELETE /api/masters/approval-chain
 *   — delete a stage. Body: { id }
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

  const moduleFilter = request.nextUrl.searchParams.get('module');
  const where: Record<string, unknown> = { companyId: scope.companyId };
  if (moduleFilter) where.module = moduleFilter;

  const data = await prisma.approvalChainConfig.findMany({
    where,
    orderBy: [{ module: 'asc' }, { stageOrder: 'asc' }],
  });

  return NextResponse.json({ data });
}

const createSchema = z.object({
  module: z.string().min(1).max(50),
  stageName: z.string().min(1).max(50),
  stageOrder: z.number().int().positive(),
  approverType: z.enum(['REPORTING_MANAGER', 'HR', 'ROLE', 'SPECIFIC_USER']),
  approverRoleId: z.number().int().positive().optional(),
  approverUserId: z.number().int().positive().optional(),
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

  // Upsert: if [companyId, module, stageOrder] exists, update; otherwise create.
  const existing = await prisma.approvalChainConfig.findUnique({
    where: {
      companyId_module_stageOrder: {
        companyId: scope.companyId,
        module: parsed.data.module,
        stageOrder: parsed.data.stageOrder,
      },
    },
  });

  if (existing) {
    const updated = await prisma.approvalChainConfig.update({
      where: { id: existing.id },
      data: {
        stageName: parsed.data.stageName,
        approverType: parsed.data.approverType,
        approverRoleId: parsed.data.approverRoleId ?? null,
        approverUserId: parsed.data.approverUserId ?? null,
      },
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.approvalChainConfig.create({
    data: {
      companyId: scope.companyId,
      module: parsed.data.module,
      stageName: parsed.data.stageName,
      stageOrder: parsed.data.stageOrder,
      approverType: parsed.data.approverType,
      approverRoleId: parsed.data.approverRoleId ?? null,
      approverUserId: parsed.data.approverUserId ?? null,
    },
  });
  return NextResponse.json(created);
}

export async function DELETE(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await prisma.approvalChainConfig.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}

