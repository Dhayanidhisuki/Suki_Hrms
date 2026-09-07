/**
 * GET    /api/masters/salary-components/[id]
 * PUT    /api/masters/salary-components/[id] — refused for isSystemDefined
 *        rows (Payroll/Arrear/Bonus depend on their code/type not changing).
 * DELETE /api/masters/salary-components/[id] — soft-delete; refused for
 *        isSystemDefined rows outright.
 *
 * Every operation is scoped to the caller's own company (getCompanyId()) —
 * a row belonging to a different company 404s, same cross-tenant convention
 * as every other company-scoped resource this session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { salaryComponentSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.salaryComponent.findFirst({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existing = await prisma.salaryComponent.findFirst({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = salaryComponentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (existing.isSystemDefined) {
    // code/name/type/isActive are load-bearing for Payroll/Arrear/Bonus and
    // stay locked, but includeInGratuity is a Gratuity-only flag with no
    // dependency on those — a system-defined row (e.g. Basic Salary) must
    // still be flaggable for Gratuity eligibility.
    if (
      parsed.data.code !== existing.code ||
      parsed.data.name !== existing.name ||
      parsed.data.type !== existing.type ||
      parsed.data.isActive !== existing.isActive
    ) {
      return NextResponse.json({ error: 'This is a system-defined component — only "Include in Gratuity" can be changed.' }, { status: 409 });
    }
    const record = await prisma.salaryComponent.update({ where: { id: existing.id }, data: { includeInGratuity: parsed.data.includeInGratuity } });
    return NextResponse.json(record);
  }

  if (parsed.data.code !== existing.code) {
    const codeClash = await prisma.salaryComponent.findUnique({
      where: { companyId_code: { companyId: scope.companyId, code: parsed.data.code } },
    });
    if (codeClash && codeClash.deletedAt === null) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }
  }

  const record = await prisma.salaryComponent.update({ where: { id: existing.id }, data: parsed.data });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existing = await prisma.salaryComponent.findFirst({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.isSystemDefined) {
    return NextResponse.json({ error: 'This is a system-defined component required by Payroll/Arrear/Bonus and cannot be deleted.' }, { status: 409 });
  }

  await prisma.salaryComponent.update({ where: { id: existing.id }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
