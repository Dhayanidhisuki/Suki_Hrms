/**
 * GET    /api/employees/[id]/deduction-exclusions — this employee's per-code
 *        overrides ({ deductionCode, excluded, overrideAmount }[]) against
 *        the company's Deduction Rates.
 * POST   /api/employees/[id]/deduction-exclusions — exclude a code entirely
 *        (Remove) or set a fixed override amount for it (Edit). Body:
 *        { deductionCode, excluded?: boolean, overrideAmount?: number|null }.
 * DELETE /api/employees/[id]/deduction-exclusions?code=CANTEEN — clear any
 *        override for a code, back to "use the rate as configured".
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { z } from 'zod';

const bodySchema = z.object({
  deductionCode: z.string().min(1).max(20),
  excluded: z.boolean().optional(),
  overrideAmount: z.number().nonnegative().nullable().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const rows = await prisma.employeeDeductionExclusion.findMany({
    where: { employeeId: parseInt(id) },
    select: { deductionCode: true, excluded: true, overrideAmount: true },
  });
  return NextResponse.json({
    data: rows.map((r) => ({ deductionCode: r.deductionCode, excluded: r.excluded, overrideAmount: r.overrideAmount != null ? Number(r.overrideAmount) : null })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { deductionCode, excluded = true, overrideAmount = null } = parsed.data;

  await prisma.employeeDeductionExclusion.upsert({
    where: { employeeId_deductionCode: { employeeId, deductionCode } },
    create: { employeeId, deductionCode, excluded, overrideAmount },
    update: { excluded, overrideAmount },
  });
  return NextResponse.json({ message: 'Saved' }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code query param required' }, { status: 400 });

  await prisma.employeeDeductionExclusion.deleteMany({ where: { employeeId, deductionCode: code } });
  return NextResponse.json({ message: 'Cleared' });
}
