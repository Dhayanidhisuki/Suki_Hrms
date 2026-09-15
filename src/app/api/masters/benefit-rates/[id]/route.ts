import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { benefitRateSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.benefitRateByEmployeeType.findFirst({
    where: { id: parseInt(id) },
    include: {
      company: { select: { id: true, name: true } },
      employeeType: { select: { id: true, name: true } },
      salaryComponent: { select: { id: true, code: true, name: true } },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const parsed = benefitRateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.benefitRateByEmployeeType.findFirst({
    where: { companyId: parsed.data.companyId, code: parsed.data.code, NOT: { id: parseInt(id) } },
  });
  if (existing) return NextResponse.json({ error: 'Code already exists in this company' }, { status: 409 });

  const record = await prisma.benefitRateByEmployeeType.update({
    where: { id: parseInt(id) },
    data: parsed.data,
    include: {
      company: { select: { id: true, name: true } },
      employeeType: { select: { id: true, name: true } },
      salaryComponent: { select: { id: true, code: true, name: true } },
    },
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.benefitRateByEmployeeType.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' });
}
