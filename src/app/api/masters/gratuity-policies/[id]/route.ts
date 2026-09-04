import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { gratuityPolicySchema } from '@/lib/validations/master';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.gratuityPolicy.findFirst({ where: { id: parseInt(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existing = await prisma.gratuityPolicy.findFirst({ where: { id: parseInt(id), companyId: scope.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = gratuityPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.gratuityPolicy.update({ where: { id: existing.id }, data: parsed.data });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existing = await prisma.gratuityPolicy.findFirst({ where: { id: parseInt(id), companyId: scope.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.gratuityPolicy.update({ where: { id: existing.id }, data: { isActive: false } });
  return NextResponse.json({ message: 'Deactivated' });
}
