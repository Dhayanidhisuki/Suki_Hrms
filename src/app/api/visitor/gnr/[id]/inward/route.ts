import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkGNRPermission } from '@/lib/rbac-gnr';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'inward');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const gnrId = Number(id);
  if (isNaN(gnrId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const gnr = await prisma.gateNumberRegister.findFirst({
    where: { id: gnrId, companyId: scope.companyId, deletedAt: null },
  });
  if (!gnr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const inwardMovement = ['MATERIAL_INWARD', 'RETURNABLE', 'NON_RETURNABLE', 'SERVICE_REPAIR'];
  if (!inwardMovement.includes(gnr.movementType)) {
    return NextResponse.json({ error: 'This movement type is not inward' }, { status: 400 });
  }

  if (gnr.status === 'CANCELLED' || gnr.status === 'REJECTED' || gnr.status === 'COMPLETED') {
    return NextResponse.json({ error: 'GNR cannot be updated' }, { status: 400 });
  }

  // For outward-like movement types, authorization is required; for inward types, DC/GNR is enough.
  const needsAuth = gnr.movementType === 'MATERIAL_OUTWARD' || gnr.movementType === 'NON_RETURNABLE';
  if (needsAuth && gnr.status !== 'AUTHORIZED') {
    return NextResponse.json({ error: 'GNR must be authorized before outward movement' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = Number(request.headers.get('x-user-id')) || null;

  const updated = await prisma.gateNumberRegister.update({
    where: { id: gnr.id },
    data: {
      status: 'INWARD_RECORDED',
      inwardBy: userId,
      inwardTime: new Date(),
      inwardRemarks: body?.remarks ? String(body.remarks) : null,
      gateId: body?.gate ? String(body.gate) : gnr.gateId,
      updatedBy: userId,
    },
  });

  const gnrCreator = updated.createdBy ? await prisma.user.findUnique({ where: { id: updated.createdBy }, select: { email: true } }) : null;

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'GNR_INWARD',
    recipients: [
      ...(updated.contactName ? [{ channel: 'IN_APP' as const, address: updated.contactName }] : []),
      ...(gnrCreator?.email ? [{ channel: 'IN_APP' as const, address: gnrCreator.email }] : []),
    ],
    subject: `GNR ${updated.gnrNo} inward recorded`,
    body: `Inward movement for GNR ${updated.gnrNo} has been recorded at ${updated.inwardTime?.toLocaleString()}.`,
    gnrId: updated.id,
  });

  return NextResponse.json(updated);
}
