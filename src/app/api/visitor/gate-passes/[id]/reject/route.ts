import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';
import { notifyVisitorPass } from '@/lib/ess/notifyVisitorPass';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const passId = Number(id);
  if (isNaN(passId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const pass = await prisma.visitorGatePass.findFirst({
    where: { id: passId, companyId: scope.companyId, deletedAt: null },
    include: {
      personToMeet: { select: { firstName: true, lastName: true } },
    },
  });
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Mirror the approve route: the host may decline a visit to themselves
  // without the HR-level visitor.gate.reject grant.
  const ownEmployeeId = await resolveOwnEmployeeId(Number(request.headers.get('x-user-id')));
  const isHost = ownEmployeeId != null && ownEmployeeId === pass.personToMeetId;
  if (!isHost) {
    const permErr = await checkVisitorPermission(request, 'reject');
    if (permErr) return permErr;
  }
  if (pass.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Only PENDING_APPROVAL requests can be rejected' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body?.reason) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.visitorGatePass.update({
    where: { id: pass.id },
    data: {
      status: 'REJECTED',
      approvedBy: userId,
      approvedAt: new Date(),
      rejectionReason: String(body.reason),
      updatedBy: userId,
    },
  });

  const requester = pass.createdBy ? await prisma.user.findUnique({ where: { id: pass.createdBy }, select: { email: true } }) : null;

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'VISITOR_REJECTED',
    recipients: [
      ...(requester?.email ? [{ channel: 'IN_APP' as const, address: requester.email }] : []),
    ],
    subject: `Visitor request ${updated.gatePassNo} rejected`,
    body: `Visitor ${updated.visitorName} was rejected. Reason: ${String(body.reason)}`,
    visitorGatePassId: updated.id,
  });

  await notifyVisitorPass({
    companyId: scope.companyId,
    action: 'REJECTED',
    pass: updated,
    hostName: `${pass.personToMeet.firstName} ${pass.personToMeet.lastName}`,
    reason: String(body.reason),
  });

  return NextResponse.json(updated);
}
