import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkGNRPermission } from '@/lib/rbac-gnr';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'authorize');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const gnrId = Number(id);
  if (isNaN(gnrId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const gnr = await prisma.gateNumberRegister.findFirst({
    where: { id: gnrId, companyId: scope.companyId, deletedAt: null },
  });
  if (!gnr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (gnr.status !== 'GNR_CREATED' && gnr.status !== 'AWAITING_AUTHORIZATION') {
    return NextResponse.json({ error: 'GNR cannot be authorized from this status' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = Number(request.headers.get('x-user-id')) || null;

  const updated = await prisma.gateNumberRegister.update({
    where: { id: gnr.id },
    data: {
      status: 'AUTHORIZED',
      authorizedBy: userId,
      authorizedAt: new Date(),
      authorizationRef: body?.ref ? String(body.ref) : gnr.authorizationRef,
      updatedBy: userId,
    },
  });

  const gnrCreator = updated.createdBy ? await prisma.user.findUnique({ where: { id: updated.createdBy }, select: { email: true } }) : null;

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'GNR_AUTHORIZED',
    recipients: [
      ...(updated.contactName ? [{ channel: 'IN_APP' as const, address: updated.contactName }] : []),
      ...(gnrCreator?.email ? [{ channel: 'IN_APP' as const, address: gnrCreator.email }] : []),
    ],
    subject: `GNR ${updated.gnrNo} authorized`,
    body: `GNR ${updated.gnrNo} for DC ${updated.dcNo} has been authorized for outward movement.`,
    gnrId: updated.id,
  });

  return NextResponse.json(updated);
}
