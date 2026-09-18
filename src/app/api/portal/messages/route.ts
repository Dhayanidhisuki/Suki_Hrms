/**
 * Portal Messages API (BRD §10.6).
 * GET  /api/portal/messages?t=<token> — list messages (candidate + HR)
 * POST /api/portal/messages?t=<token> — candidate sends a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { portalMessageSchema } from '@/lib/validations/recruitment';

async function verifyToken(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');
  if (!token) return null;
  const record = await prisma.candidatePortalToken.findUnique({ where: { token } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
  await prisma.candidatePortalToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record.candidateId;
}

export async function GET(request: NextRequest) {
  const candidateId = await verifyToken(request);
  if (!candidateId) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const messages = await prisma.candidatePortalMessage.findMany({
    where: { candidateId },
    orderBy: { createdAt: 'asc' },
  });

  // Mark HR messages as read when candidate views them
  await prisma.candidatePortalMessage.updateMany({
    where: { candidateId, fromRole: 'hr', isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ data: messages });
}

export async function POST(request: NextRequest) {
  const candidateId = await verifyToken(request);
  if (!candidateId) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const body = await request.json();
  const parsed = portalMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { firstName: true, lastName: true } });
  const fromName = parsed.data.fromName ?? `${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim();

  const message = await prisma.candidatePortalMessage.create({
    data: {
      candidateId,
      fromRole: 'candidate',
      fromName,
      message: parsed.data.message,
    },
  });

  return NextResponse.json(message, { status: 201 });
}
