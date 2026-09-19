import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // The host approving a visit to themselves never needs the HR-level
  // visitor.gate.approve grant — same self-service convention as every other
  // ESS surface here. Acting on anyone else's pass still requires it.
  // (Role EMP does not hold that grant, so without this the ESS Visitor Pass
  // Approval page could list a pass but 403 on the approve button.)
  const ownEmployeeId = await resolveOwnEmployeeId(Number(request.headers.get('x-user-id')));
  const isHost = ownEmployeeId != null && ownEmployeeId === pass.personToMeetId;
  if (!isHost) {
    const permErr = await checkVisitorPermission(request, 'approve');
    if (permErr) return permErr;
  }
  if (pass.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Only PENDING_APPROVAL requests can be approved' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = Number(request.headers.get('x-user-id')) || null;

  const updated = await prisma.visitorGatePass.update({
    where: { id: pass.id },
    data: {
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      approvalComments: body?.comments ? String(body.comments) : null,
      updatedBy: userId,
    },
  });

  const requester = pass.createdBy ? await prisma.user.findUnique({ where: { id: pass.createdBy }, select: { email: true } }) : null;

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'VISITOR_APPROVED',
    recipients: [
      ...(requester?.email ? [{ channel: 'IN_APP' as const, address: requester.email }] : []),
      ...(pass.personToMeet?.user?.email && pass.personToMeet.user.email !== requester?.email ? [{ channel: 'IN_APP' as const, address: pass.personToMeet.user.email }] : []),
    ],
    subject: `Visitor request ${updated.gatePassNo} approved`,
    body: `Visitor ${updated.visitorName} has been approved. QR pass is valid from ${updated.validFrom.toLocaleString()} to ${updated.validTo.toLocaleString()}.`,
    visitorGatePassId: updated.id,
  });

  return NextResponse.json(updated);
}
