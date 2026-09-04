/**
 * POST /api/bonus/records/[id]/release-hold — HOLD → CALCULATED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.bonusRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'HOLD') {
    return NextResponse.json({ error: `Cannot release hold on a bonus record in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.bonusRecord.update({
    where: { id: record.id },
    data: { status: 'CALCULATED', holdReason: null },
  });

  return NextResponse.json(updated);
}
