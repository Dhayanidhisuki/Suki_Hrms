/**
 * Call Interview API — list (filter by candidate) + create (BRD §5.4).
 *
 * GET  /api/recruitment/call-interviews?candidateId=&page=&limit=
 * POST /api/recruitment/call-interviews
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callInterviewCreateSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, mobile: true, email: true } },
  recruiter: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const candidateId = searchParams.get('candidateId');

  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = parseInt(candidateId);

  const [data, total] = await Promise.all([
    prisma.callInterview.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include,
    }),
    prisma.callInterview.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = callInterviewCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({ where: { id: parsed.data.candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const record = await prisma.callInterview.create({ data: parsed.data, include });

  // Update candidate status to CALL_INTERVIEW if outcome is "Proceed"
  if (parsed.data.callOutcome === 'Proceed' || parsed.data.callOutcome === 'Connected-Interested') {
    const callStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'CALL_INTERVIEW' } });
    if (callStatus) {
      const fromStatus = candidate.currentStatusId
        ? (await prisma.recruitmentStatus.findUnique({ where: { id: candidate.currentStatusId } }))?.statusCode ?? null
        : null;
      await prisma.$transaction([
        prisma.candidate.update({ where: { id: candidate.id }, data: { currentStatusId: callStatus.id } }),
        prisma.candidateActivityLog.create({
          data: {
            candidateId: candidate.id,
            action: `Call interview — ${parsed.data.callOutcome}`,
            fromStatus,
            toStatus: 'CALL_INTERVIEW',
            remarks: parsed.data.remarks ?? null,
          },
        }),
      ]);
    }
  }

  return NextResponse.json(record, { status: 201 });
}
