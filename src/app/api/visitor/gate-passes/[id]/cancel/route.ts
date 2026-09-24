import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { notifyVisitorPass } from '@/lib/ess/notifyVisitorPass';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'cancel');
  if (permErr) return permErr;
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
  if (pass.status === 'CHECKED_OUT' || pass.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Pass already cancelled or checked out' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.visitorGatePass.update({
    where: { id: pass.id },
    data: {
      status: 'CANCELLED',
      updatedBy: userId,
    },
  });

  await notifyVisitorPass({
    companyId: scope.companyId,
    action: 'CANCELLED',
    pass: updated,
    hostName: `${pass.personToMeet.firstName} ${pass.personToMeet.lastName}`,
    reason: undefined,
  });

  return NextResponse.json(updated);
}
