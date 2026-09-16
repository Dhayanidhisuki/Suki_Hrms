/**
 * GET  /api/platform/workflow/matrices?requestTypeCode=&includeInactive=1  — list headers (platform.workflow.view)
 * POST /api/platform/workflow/matrices                                     — create v1 with lines (platform.workflow.admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { errorResponse, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { decimalOrNull, isoToUtcDate, lineData, utcToday } from '@/lib/platform/workflow/matrixInput';
import { wfMatrixCreateSchema } from '@/lib/validations/platform-workflow';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const q = request.nextUrl.searchParams;
  const requestTypeCode = q.get('requestTypeCode') || undefined;
  const includeInactive = q.get('includeInactive') === '1';
  const data = await prisma.workflowMatrix.findMany({
    where: { companyId: scope.companyId, ...(requestTypeCode ? { requestTypeCode } : {}), ...(includeInactive ? {} : { status: 'Active' }) },
    orderBy: [{ requestTypeCode: 'asc' }, { code: 'asc' }, { versionNo: 'desc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfMatrixCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  try {
    const actor = await resolveActor(request);
    const requestType = await prisma.workflowRequestType.findFirst({ where: { companyId: scope.companyId, code: b.requestTypeCode.toUpperCase() } });
    if (!requestType) return NextResponse.json({ error: `Request type ${b.requestTypeCode} is not registered` }, { status: 404 });

    const existing = await prisma.workflowMatrix.findFirst({ where: { companyId: scope.companyId, code: b.code.toUpperCase() } });
    if (existing) return NextResponse.json({ error: 'Matrix code already exists — use PUT /matrices/[id] to create a new version' }, { status: 409 });

    if (b.isFallback) {
      const otherFallback = await prisma.workflowMatrix.findFirst({ where: { companyId: scope.companyId, requestTypeCode: requestType.code, isFallback: true, status: 'Active', effectiveTo: null } });
      if (otherFallback) return NextResponse.json({ error: `Request type already has an active fallback matrix (${otherFallback.code})` }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const matrix = await tx.workflowMatrix.create({
        data: {
          companyId: scope.companyId,
          code: b.code.toUpperCase(),
          name: b.name,
          requestTypeCode: requestType.code,
          versionNo: 1,
          effectiveFrom: b.effectiveFrom ? isoToUtcDate(b.effectiveFrom) : utcToday(),
          effectiveTo: b.effectiveTo ? isoToUtcDate(b.effectiveTo) : null,
          isFallback: b.isFallback ?? false,
          status: b.status ?? 'Active',
          minAmount: decimalOrNull(b.minAmount),
          maxAmount: decimalOrNull(b.maxAmount),
          designationCodes: b.designationCodes ?? null,
          departmentCodes: b.departmentCodes ?? null,
          gradeCodes: b.gradeCodes ?? null,
          employmentType: b.employmentType ?? null,
          locationCode: b.locationCode ?? null,
          costCentreCode: b.costCentreCode ?? null,
          requestSubType: b.requestSubType ?? null,
          createdByUserId: actor.userId,
        },
      });
      if (b.lines?.length) await tx.workflowMatrixLine.createMany({ data: b.lines.map((l, i) => lineData(matrix.id, l, i)) });
      await audit({ companyId: scope.companyId, entityType: 'WorkflowMatrix', entityId: matrix.id, entityRef: `${matrix.code} v1`, action: 'CREATE', actor, after: { ...matrix, lines: b.lines ?? [] } }, tx);
      return matrix;
    });
    const lines = await prisma.workflowMatrixLine.findMany({ where: { matrixId: created.id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }] });
    return NextResponse.json({ ...created, lines }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
