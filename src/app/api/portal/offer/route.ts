/**
 * Portal Offer API (BRD §10.6).
 * Candidate accepts or rejects an offer from the portal.
 *
 * POST /api/portal/offer?t=<token>&action=accept   body: { offerId }
 * POST /api/portal/offer?t=<token>&action=reject   body: { offerId, reason? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function verifyToken(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');
  if (!token) return null;
  const record = await prisma.candidatePortalToken.findUnique({ where: { token } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
  await prisma.candidatePortalToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record.candidateId;
}

export async function POST(request: NextRequest) {
  const candidateId = await verifyToken(request);
  if (!candidateId) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 });
  }

  const body = await request.json();
  const offerId = Number(body.offerId);
  if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });

  const offer = await prisma.offerLetter.findFirst({ where: { id: offerId, candidateId } });
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  if (offer.status !== 'Sent') {
    return NextResponse.json({ error: `Offer cannot be ${action === 'accept' ? 'accepted' : 'rejected'} (current status: ${offer.status})` }, { status: 400 });
  }

  const newStatus = action === 'accept' ? 'Accepted' : 'Rejected';
  await prisma.offerLetter.update({
    where: { id: offerId },
    data: {
      status: newStatus,
      acceptedAt: action === 'accept' ? new Date() : null,
      remarks: body.reason ?? offer.remarks,
    },
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId,
      action: `Offer ${newStatus} via portal — ${offer.offerNo}`,
      remarks: body.reason ?? null,
    },
  });

  // If rejected, trigger rejection email (BRD §10.4)
  if (action === 'reject') {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { firstName: true, lastName: true, email: true, designation: { select: { name: true } } } });
    if (candidate?.email) {
      try {
        const { triggerRejectionEmail } = await import('@/lib/recruitment/email-automation');
        await triggerRejectionEmail(
          candidateId,
          candidate.email,
          `${candidate.firstName} ${candidate.lastName}`,
          candidate.designation?.name ?? null,
          null
        );
      } catch {
        // email logging failure should not block the action
      }
    }
  }

  return NextResponse.json({ message: `Offer ${newStatus}`, offerId });
}
