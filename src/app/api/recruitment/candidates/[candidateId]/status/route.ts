/**
 * Candidate status update — POST /api/recruitment/candidates/:id/status
 * Updates currentStatusId and logs an activity entry (BRD §5.2).
 * Auto-triggers rejection email when status → REJECTED (BRD §10.4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateStatusUpdateSchema } from '@/lib/validations/recruitment';
import { triggerRejectionEmail } from '@/lib/recruitment/email-automation';

export async function POST(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId: candidateIdParam } = await params;
  const body = await request.json();
  const parsed = candidateStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidateId = parseInt(candidateIdParam);
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, deletedAt: null },
    include: { department: true, designation: true },
  });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const newStatus = await prisma.recruitmentStatus.findUnique({ where: { id: parsed.data.statusId } });
  if (!newStatus) return NextResponse.json({ error: 'Status not found' }, { status: 404 });

  const fromStatus = candidate.currentStatusId
    ? (await prisma.recruitmentStatus.findUnique({ where: { id: candidate.currentStatusId } }))?.statusCode ?? null
    : null;

  await prisma.$transaction([
    prisma.candidate.update({
      where: { id: candidateId },
      data: { currentStatusId: parsed.data.statusId },
    }),
    prisma.candidateActivityLog.create({
      data: {
        candidateId,
        action: `Status changed to ${newStatus.statusName}`,
        fromStatus,
        toStatus: newStatus.statusCode,
        remarks: parsed.data.remarks ?? null,
      },
    }),
  ]);

  // Rejection automation (BRD §10.4) — auto-log rejection email when status → REJECTED
  if (newStatus.statusCode === 'REJECTED' && candidate.email) {
    try {
      await triggerRejectionEmail(
        candidateId,
        candidate.email,
        `${candidate.firstName} ${candidate.lastName}`,
        candidate.designation?.name ?? null,
        null
      );
    } catch {
      // Email logging failure should not block the status update
    }
  }

  return NextResponse.json({ message: 'Status updated', status: newStatus });
}
