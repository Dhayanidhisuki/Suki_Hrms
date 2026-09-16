/**
 * GET /api/platform/workflow/matrices/[id]  — header + lines (platform.workflow.view)
 * PUT /api/platform/workflow/matrices/[id]  — creates a NEW VERSION (platform.workflow.admin):
 *     the existing row is closed (effectiveTo = day before the new effectiveFrom,
 *     status Inactive) and never edited; lines are copied unless supplied. A
 *     live request stays bound to the version it was submitted under (§7.6).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { errorResponse, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { decimalOrNull, isoToUtcDate, lineData, utcToday } from '@/lib/platform/workflow/matrixInput';
import { wfMatrixVersionSchema } from '@/lib/validations/platform-workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const matrix = await prisma.workflowMatrix.findFirst({ where: { id, companyId: scope.companyId } });
  if (!matrix) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const lines = await prisma.workflowMatrixLine.findMany({ where: { matrixId: id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }] });
  return NextResponse.json({ ...matrix, lines });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfMatrixVersionSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  try {
    const actor = await resolveActor(request);
    const previous = await prisma.workflowMatrix.findFirst({ where: { id, companyId: scope.companyId } });
    if (!previous) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const latest = await prisma.workflowMatrix.findFirst({ where: { companyId: scope.companyId, code: previous.code }, orderBy: { versionNo: 'desc' } });
    if (latest && latest.id !== previous.id) {
      return NextResponse.json({ error: `Version ${previous.versionNo} is not the latest; edit v${latest.versionNo} (id ${latest.id})` }, { status: 409 });
    }
    const prevLines = await prisma.workflowMatrixLine.findMany({ where: { matrixId: previous.id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }] });

    const effectiveFrom = b.effectiveFrom ? isoToUtcDate(b.effectiveFrom) : utcToday();
    const dayBefore = new Date(effectiveFrom.getTime() - 24 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const next = await tx.workflowMatrix.create({
        data: {
          companyId: scope.companyId,
          code: previous.code,
          name: b.name ?? previous.name,
          requestTypeCode: previous.requestTypeCode,
          versionNo: previous.versionNo + 1,
          effectiveFrom,
          effectiveTo: b.effectiveTo === undefined ? null : b.effectiveTo ? isoToUtcDate(b.effectiveTo) : null,
          isFallback: b.isFallback ?? previous.isFallback,
          status: b.status ?? 'Active',
          minAmount: b.minAmount === undefined ? previous.minAmount : decimalOrNull(b.minAmount),
          maxAmount: b.maxAmount === undefined ? previous.maxAmount : decimalOrNull(b.maxAmount),
          designationCodes: b.designationCodes === undefined ? previous.designationCodes : b.designationCodes,
          departmentCodes: b.departmentCodes === undefined ? previous.departmentCodes : b.departmentCodes,
          gradeCodes: b.gradeCodes === undefined ? previous.gradeCodes : b.gradeCodes,
          employmentType: b.employmentType === undefined ? previous.employmentType : b.employmentType,
          locationCode: b.locationCode === undefined ? previous.locationCode : b.locationCode,
          costCentreCode: b.costCentreCode === undefined ? previous.costCentreCode : b.costCentreCode,
          requestSubType: b.requestSubType === undefined ? previous.requestSubType : b.requestSubType,
          createdByUserId: actor.userId,
        },
      });
      const lines = b.lines?.length
        ? b.lines.map((l, i) => lineData(next.id, l, i))
        : prevLines.map((l) => {
            const { id: _id, matrixId: _m, ...rest } = l;
            void _id;
            void _m;
            return { ...rest, matrixId: next.id };
          });
      if (lines.length) await tx.workflowMatrixLine.createMany({ data: lines });
      // Close the previous version; never edit its conditions or lines.
      await tx.workflowMatrix.update({ where: { id: previous.id }, data: { effectiveTo: dayBefore, status: 'Inactive' } });
      await audit({ companyId: scope.companyId, entityType: 'WorkflowMatrix', entityId: next.id, entityRef: `${next.code} v${next.versionNo}`, action: 'CONFIG_CHANGE', actor, before: { ...previous, lines: prevLines }, after: { ...next, lines } }, tx);
      return next;
    });
    const lines = await prisma.workflowMatrixLine.findMany({ where: { matrixId: created.id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }] });
    return NextResponse.json({ ...created, lines }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
