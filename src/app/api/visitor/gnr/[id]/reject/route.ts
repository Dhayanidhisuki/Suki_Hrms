import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkGNRPermission } from '@/lib/rbac-gnr';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'delete');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const gnrId = Number(id);
  if (isNaN(gnrId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const gnr = await prisma.gateNumberRegister.findFirst({
    where: { id: gnrId, companyId: scope.companyId, deletedAt: null },
  });
  if (!gnr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (gnr.status === 'INWARD_RECORDED' || gnr.status === 'OUTWARD_RECORDED' || gnr.status === 'COMPLETED' || gnr.status === 'CANCELLED') {
    return NextResponse.json({ error: 'GNR cannot be rejected after transaction' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body?.reason) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;

  const updated = await prisma.gateNumberRegister.update({
    where: { id: gnr.id },
    data: {
      status: 'REJECTED',
      rejectionReason: String(body.reason),
      updatedBy: userId,
    },
  });

  return NextResponse.json(updated);
}
