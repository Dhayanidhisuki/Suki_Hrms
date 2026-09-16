/**
 * PUT /api/platform/workflow/matrices/[id]/lines — replace ALL lines of a
 * matrix version (platform.workflow.admin). Refused with 409 once any request
 * has been bound to this version: create a new version instead (§7.6).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { errorResponse, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { lineData } from '@/lib/platform/workflow/matrixInput';
import { wfMatrixLinesSchema } from '@/lib/validations/platform-workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfMatrixLinesSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  try {
    const matrix = await prisma.workflowMatrix.findFirst({ where: { id, companyId: scope.companyId } });
    if (!matrix) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const inUse = await prisma.workflowRequest.count({ where: { companyId: scope.companyId, matrixId: matrix.id, matrixVersionNo: matrix.versionNo } });
    if (inUse > 0) return NextResponse.json({ error: `Matrix version is bound to ${inUse} request(s); create a new version instead` }, { status: 409 });

    const actor = await resolveActor(request);
    const before = await prisma.workflowMatrixLine.findMany({ where: { matrixId: id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }] });
    const lines = await prisma.$transaction(async (tx) => {
      await tx.workflowMatrixLine.deleteMany({ where: { matrixId: id } });
      await tx.workflowMatrixLine.createMany({ data: parsed.data.lines.map((l, i) => lineData(id, l, i)) });
      const after = await tx.workflowMatrixLine.findMany({ where: { matrixId: id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }] });
      await audit({ companyId: scope.companyId, entityType: 'WorkflowMatrix', entityId: id, entityRef: `${matrix.code} v${matrix.versionNo}`, action: 'CONFIG_CHANGE', actor, before: { lines: before }, after: { lines: after } }, tx);
      return after;
    });
    return NextResponse.json({ ...matrix, lines });
  } catch (err) {
    return errorResponse(err);
  }
}
