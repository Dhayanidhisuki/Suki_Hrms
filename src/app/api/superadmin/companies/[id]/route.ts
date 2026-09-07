/**
 * GET    /api/superadmin/companies/[id]   — get single company
 * PUT    /api/superadmin/companies/[id]   — update company
 * DELETE /api/superadmin/companies/[id]   — soft-delete company
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/rbac-superadmin';
import { companySchema } from '@/lib/validations/company';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await requireSuperAdmin(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.company.findFirst({
    where: { id: parseInt(id), deletedAt: null },
  });

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await requireSuperAdmin(request);
  if (permErr) return permErr;
  const { id } = await params;
  const body = await request.json();
  const parsed = companySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.company.findFirst({
    where: { code: parsed.data.code, NOT: { id: parseInt(id) } },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json(
      { error: 'Code already exists' },
      { status: 409 }
    );
  }

  const record = await prisma.company.update({
    where: { id: parseInt(id) },
    data: parsed.data,
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await requireSuperAdmin(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.company.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
