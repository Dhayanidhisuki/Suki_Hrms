import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'checkin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const passId = Number(id);
  if (isNaN(passId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  const pass = await prisma.visitorGatePass.findFirst({
    where: { id: passId, companyId: scope.companyId, deletedAt: null },
    include: {
      personToMeet: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
    },
  });
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (pass.status !== 'APPROVED') return NextResponse.json({ error: 'Pass is not approved' }, { status: 400 });

  const now = new Date();
  if (now < pass.validFrom || now > pass.validTo) {
    return NextResponse.json({ error: 'Pass is outside the valid visit window' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.visitorGatePass.update({
    where: { id: pass.id },
    data: {
      status: 'CHECKED_IN',
      checkInBy: userId,
      checkInTime: now,
      checkInGate: body?.gate ? String(body.gate) : null,
      updatedBy: userId,
    },
  });

  notifyVisitorEvent({
    companyId: scope.companyId,
    event: 'VISITOR_CHECKED_IN',
    recipients: [
      ...(pass.personToMeet?.user?.email ? [{ channel: 'IN_APP' as const, address: pass.personToMeet.user.email }] : []),
    ],
    subject: `Visitor ${updated.visitorName} checked in`,
    body: `Visitor ${updated.visitorName} has checked in at ${updated.checkInTime?.toLocaleString()} (${updated.checkInGate ?? 'main gate'}).`,
    visitorGatePassId: updated.id,
  });

  return NextResponse.json(updated);
}
