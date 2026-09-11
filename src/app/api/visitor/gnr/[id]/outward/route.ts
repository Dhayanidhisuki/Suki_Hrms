import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkGNRPermission } from '@/lib/rbac-gnr';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'outward');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const gnrId = Number(id);
  if (isNaN(gnrId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const gnr = await prisma.gateNumberRegister.findFirst({
    where: { id: gnrId, companyId: scope.companyId, deletedAt: null },
  });
  if (!gnr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (gnr.movementType !== 'MATERIAL_OUTWARD') {
    return NextResponse.json({ error: 'This GNR is not an outward movement' }, { status: 400 });
  }
  if (gnr.status !== 'AUTHORIZED') {
    return NextResponse.json({ error: 'Outward movement requires authorization' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = Number(request.headers.get('x-user-id')) || null;

  const updated = await prisma.gateNumberRegister.update({
    where: { id: gnr.id },
    data: {
      status: 'OUTWARD_RECORDED',
      outwardBy: userId,
      outwardTime: new Date(),
      outwardRemarks: body?.remarks ? String(body.remarks) : null,
      gateId: body?.gate ? String(body.gate) : gnr.gateId,
      updatedBy: userId,
    },
  });

  const gnrCreator = updated.createdBy ? await prisma.user.findUnique({ where: { id: updated.createdBy }, select: { email: true } }) : null;

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'GNR_OUTWARD',
    recipients: [
      ...(updated.contactName ? [{ channel: 'IN_APP' as const, address: updated.contactName }] : []),
      ...(gnrCreator?.email ? [{ channel: 'IN_APP' as const, address: gnrCreator.email }] : []),
    ],
    subject: `GNR ${updated.gnrNo} outward recorded`,
    body: `Outward movement for GNR ${updated.gnrNo} has been recorded at ${updated.outwardTime?.toLocaleString()}.`,
    gnrId: updated.id,
  });

  return NextResponse.json(updated);
}
