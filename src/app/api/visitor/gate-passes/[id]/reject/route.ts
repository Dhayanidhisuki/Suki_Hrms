import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'reject');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const passId = Number(id);
  if (isNaN(passId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const pass = await prisma.visitorGatePass.findFirst({
    where: { id: passId, companyId: scope.companyId, deletedAt: null },
  });
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

  return NextResponse.json(updated);
}
