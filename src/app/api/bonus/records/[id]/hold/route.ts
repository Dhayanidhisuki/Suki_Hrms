/**
 * POST /api/bonus/records/[id]/hold — CALCULATED → HOLD. Requires
 * holdReason (BRD's "Hold without reason → Do not allow").
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { holdBonusSchema } from '@/lib/validations/bonus';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const parsed = holdBonusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.bonusRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'CALCULATED') {
    return NextResponse.json({ error: `Cannot hold a bonus record in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.bonusRecord.update({
    where: { id: record.id },
    data: { status: 'HOLD', holdReason: parsed.data.holdReason },
  });

  return NextResponse.json(updated);
}
