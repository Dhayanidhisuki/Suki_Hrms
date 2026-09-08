import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { benefitRateSchema } from '@/lib/validations/master';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const parsed = benefitRateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const record = await prisma.benefitRateByEmployeeType.update({ where: { id: parseInt(id) }, data: parsed.data });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.benefitRateByEmployeeType.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' });
}
