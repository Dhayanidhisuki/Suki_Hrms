import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';
import { notifyVisitorPass } from '@/lib/ess/notifyVisitorPass';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'edit');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const passId = Number(id);
  if (isNaN(passId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const pass = await prisma.visitorGatePass.findFirst({
    where: { id: passId, companyId: scope.companyId, deletedAt: null },
    include: {
      personToMeet: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
    },
  });
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (pass.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT requests can be submitted' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.visitorGatePass.update({
    where: { id: pass.id },
    data: {
      status: 'PENDING_APPROVAL',
      updatedBy: userId,
    },
  });

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'VISITOR_SUBMITTED',
    recipients: [
      ...(pass.personToMeet?.user?.email ? [{ channel: 'IN_APP' as const, address: pass.personToMeet.user.email }] : []),
    ],
    subject: `Visitor request ${updated.gatePassNo} submitted for approval`,
    body: `Visitor ${updated.visitorName} is requesting to meet ${pass.personToMeet.firstName} ${pass.personToMeet.lastName} on ${updated.visitDate.toDateString()}.`,
    visitorGatePassId: updated.id,
  });

  await notifyVisitorPass({
    companyId: scope.companyId,
    action: 'SUBMITTED',
    pass: updated,
    hostName: `${pass.personToMeet.firstName} ${pass.personToMeet.lastName}`,
    reason: undefined,
  });

  return NextResponse.json(updated);
}
