import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { z } from 'zod';

const updateSchema = z.object({
  benefitRateIds: z.array(z.number().int().positive()),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;

  const employee = await prisma.employee.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    select: {
      id: true,
      companyId: true,
      jobInfos: { where: { effectiveTo: null }, take: 1, select: { employeeTypeId: true } },
    },
  });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const jobEmployeeTypeId = employee.jobInfos[0]?.employeeTypeId ?? null;

  const [selected, available] = await Promise.all([
    prisma.employeeBenefit.findMany({
      where: { employeeId: employee.id, isActive: true },
      include: {
        benefitRate: {
          select: { id: true, code: true, name: true, employeeType: { select: { id: true, name: true } }, amount: true },
        },
      },
    }),
    prisma.benefitRateByEmployeeType.findMany({
      where: { companyId: employee.companyId, isActive: true },
      select: { id: true, code: true, name: true, employeeType: { select: { id: true, name: true } }, amount: true, employeeTypeId: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    employeeId: employee.id,
    selected: selected.map((s) => ({
      id: s.benefitRate.id,
      code: s.benefitRate.code,
      name: s.benefitRate.name,
      employeeType: s.benefitRate.employeeType?.name ?? 'All',
      amount: Number(s.benefitRate.amount),
    })),
    available: available.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      employeeType: a.employeeType?.name ?? 'All',
      amount: Number(a.amount),
      matchesType: a.employeeTypeId === null || a.employeeTypeId === jobEmployeeTypeId,
    })),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  await prisma.employeeBenefit.deleteMany({ where: { employeeId } });

  if (parsed.data.benefitRateIds.length) {
    await prisma.employeeBenefit.createMany({
      data: parsed.data.benefitRateIds.map((benefitRateId) => ({ employeeId, benefitRateId })),
    });
  }

  const selected = await prisma.employeeBenefit.findMany({
    where: { employeeId },
    include: {
      benefitRate: {
        select: { id: true, code: true, name: true, employeeType: { select: { id: true, name: true } }, amount: true },
      },
    },
  });

  return NextResponse.json({
    selected: selected.map((s) => ({
      id: s.benefitRate.id,
      code: s.benefitRate.code,
      name: s.benefitRate.name,
      employeeType: s.benefitRate.employeeType?.name ?? 'All',
      amount: Number(s.benefitRate.amount),
    })),
  });
}
