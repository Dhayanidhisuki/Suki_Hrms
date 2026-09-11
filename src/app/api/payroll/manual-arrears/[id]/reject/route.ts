/**
 * POST /api/payroll/manual-arrears/[id]/reject
 * Body: { reason: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const bodySchema = z.object({ reason: z.string().min(1).max(500) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const arrearId = parseInt(id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Reason required' }, { status: 400 });
  }

  const arrear = await prisma.manualArrear.findFirst({
    where: { id: arrearId, companyId: scope.companyId },
  });
  if (!arrear) return NextResponse.json({ error: 'Arrear not found' }, { status: 404 });
  if (arrear.status !== 'PENDING') {
    return NextResponse.json({ error: `Arrear is already ${arrear.status}` }, { status: 409 });
  }

  const updated = await prisma.manualArrear.update({
    where: { id: arrearId },
    data: { status: 'REJECTED', rejectReason: parsed.data.reason },
  });

  return NextResponse.json(updated);
}
