/**
 * Candidate Portal Token API (BRD §10.6).
 * Admin-side: generate a unique token link for a candidate.
 *
 * POST /api/recruitment/portal-tokens
 *   body: { candidateId, expiresDays? }
 *   → creates a token, returns the portal link.
 *
 * GET /api/recruitment/portal-tokens?candidateId=
 *   → lists tokens for a candidate (admin view).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
  const tokens = await prisma.candidatePortalToken.findMany({
    where: { candidateId: parseInt(candidateId) },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: tokens });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const candidateId = Number(body.candidateId);
  if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 });

  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const expiresDays = Number(body.expiresDays) || 30;
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  const record = await prisma.candidatePortalToken.create({
    data: { candidateId, token, expiresAt },
  });

  // Build the portal link (origin from request)
  const origin = new URL(request.url).origin;
  const portalLink = `${origin}/portal?t=${token}`;

  await prisma.candidateActivityLog.create({
    data: {
      candidateId,
      action: 'Portal link generated',
      remarks: `Expires ${expiresAt.toISOString()}`,
    },
  });

  return NextResponse.json({ ...record, portalLink }, { status: 201 });
}
