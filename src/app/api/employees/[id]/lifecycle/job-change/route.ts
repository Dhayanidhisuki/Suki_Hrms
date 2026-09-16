/**
 * POST /api/employees/[id]/lifecycle/job-change — record a dated job change
 * (transfer / promotion / designation change / reporting change …, BRD 01
 * §15 / §18 / §19) through changeJob: closes the open job row at
 * effectiveFrom − 1 and inserts the new full-attribute row. Back-dating is
 * HR Admin only (company-admin / hr-admin roles) within the §15.1 allowance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { canSeeEmployee, scopeContextFromHeaders } from '@/lib/employee/scope';
import { changeJob, JobChangeError, type JobChangeFields } from '@/lib/employee/resolveJob';
import { jobChangeSchema } from '@/lib/validations/employee-master';

const ADMIN_ROLE_CODES = new Set(['company-admin', 'hr-admin', 'system-admin']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'employee.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const employeeId = parseInt(id);
  const ctx = scopeContextFromHeaders(request.headers);
  if (!(await canSeeEmployee(ctx.userId, scope.companyId, employeeId, { isSuperAdmin: ctx.isSuperAdmin }))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const parsed = jobChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Referenced masters must exist (and, for company-owned ones, belong to this company).
  if (body.locationId) {
    const loc = await prisma.location.findFirst({ where: { id: body.locationId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!loc) return NextResponse.json({ error: 'Location not found or inactive' }, { status: 400 });
  }
  if (body.costCentreId) {
    const cc = await prisma.costCentre.findFirst({ where: { id: body.costCentreId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!cc) return NextResponse.json({ error: 'Cost centre not found or inactive' }, { status: 400 });
  }
  if (body.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: body.unitId, companyId: scope.companyId, deletedAt: null }, select: { id: true } });
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 400 });
  }
  if (body.gradeId && body.designationId) {
    const grade = await prisma.grade.findFirst({ where: { id: body.gradeId, deletedAt: null }, select: { designationId: true } });
    if (grade?.designationId && grade.designationId !== body.designationId) {
      return NextResponse.json({ error: 'Grade does not belong to the selected designation' }, { status: 400 });
    }
  }
  if (body.levelId && body.gradeId) {
    const level = await prisma.level.findFirst({ where: { id: body.levelId, deletedAt: null }, select: { gradeId: true } });
    if (level?.gradeId && level.gradeId !== body.gradeId) {
      return NextResponse.json({ error: 'Level does not belong to the selected grade' }, { status: 400 });
    }
  }

  const changes: JobChangeFields = {};
  const attributeKeys = [
    'departmentId', 'subDepartmentId', 'designationId', 'gradeId', 'levelId',
    'employeeTypeId', 'categoryId', 'unitId', 'locationId', 'costCentreId',
  ] as const;
  for (const key of attributeKeys) {
    const value = body[key];
    if (value !== undefined && value !== null) (changes as Record<string, unknown>)[key] = value;
  }
  // departmentId / designationId / employeeTypeId are NOT NULL — a null clears only the optional refs.
  for (const key of ['subDepartmentId', 'gradeId', 'levelId', 'categoryId', 'unitId', 'locationId', 'costCentreId'] as const) {
    if (body[key] === null) (changes as Record<string, unknown>)[key] = null;
  }
  if (body.noticePeriodDays !== undefined && body.noticePeriodDays !== null) {
    changes.noticePeriodDays = body.noticePeriodDays;
    changes.noticePeriodSource = 'MANUAL';
  }

  const reporting =
    body.reportingManagerId !== undefined || body.secondReportingManagerId !== undefined
      ? {
          ...(body.reportingManagerId !== undefined ? { primaryManagerId: body.reportingManagerId } : {}),
          ...(body.secondReportingManagerId !== undefined ? { secondaryManagerId: body.secondReportingManagerId } : {}),
        }
      : undefined;

  const roleCode = request.headers.get('x-role-code') ?? '';
  try {
    const row = await changeJob({
      companyId: scope.companyId,
      employeeId,
      effectiveFrom: body.effectiveFrom,
      changeReason: body.changeReason,
      changeReference: body.changeReference ?? null,
      changes,
      reporting,
      actor: { userId: ctx.userId || null, source: 'user' },
      isAdmin: ctx.isSuperAdmin || ADMIN_ROLE_CODES.has(roleCode),
      remarks: body.remarks ?? null,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof JobChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Job change failed' }, { status: 400 });
  }
}
