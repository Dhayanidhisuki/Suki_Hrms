import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';

/**
 * QR token lookup — returns pass summary + validity flag.
 * Used by the gate scan box and QR verification.
 * Access is the same as view permission (any logged-in company user at the gate).
 */
export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const pass = await prisma.visitorGatePass.findFirst({
    where: { qrToken: token, companyId: scope.companyId, deletedAt: null },
    include: {
      company: { select: { name: true } },
      personToMeet: { select: { firstName: true, lastName: true } },
    },
  });

  if (!pass) return NextResponse.json({ error: 'Invalid QR' }, { status: 404 });
  if (pass.status !== 'APPROVED') {
    return NextResponse.json({ error: `Pass status is ${pass.status}; not valid for entry` }, { status: 400 });
  }

  const now = new Date();
  const windowOk = now >= pass.validFrom && now <= pass.validTo;
  const qrStart = pass.approvedAt ?? pass.createdAt;
  const qrExpiresAt = new Date(qrStart.getTime() + pass.qrValidMinutes * 60 * 1000);
  const qrOk = now <= qrExpiresAt;

  return NextResponse.json({
    ok: windowOk && qrOk,
    reason: !windowOk ? 'pass not within validity window' : !qrOk ? 'qr expired' : undefined,
    pass: {
      id: pass.id,
      gatePassNo: pass.gatePassNo,
      visitorName: pass.visitorName,
      mobileNo: pass.mobileNo,
      visitorTypeValue: pass.visitorTypeValue,
      purposeValue: pass.purposeValue,
      personToMeet: `${pass.personToMeet.firstName} ${pass.personToMeet.lastName}`,
      status: pass.status,
      validFrom: pass.validFrom,
      validTo: pass.validTo,
      checkInTime: pass.checkInTime,
      checkOutTime: pass.checkOutTime,
    },
  });
}
