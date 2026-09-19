/**
 * Candidate Joining API — create joining record + initialize checklist from
 * Checklist Master (BRD §5.16, §7.1).
 *
 * GET  /api/recruitment/candidate-joinings?candidateId=
 * POST /api/recruitment/candidate-joinings
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateJoiningCreateSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  offerLetter: { select: { id: true, offerNo: true } },
  approver: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = parseInt(candidateId);
  const records = await prisma.candidateJoining.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include,
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = candidateJoiningCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: parsed.data.candidateId, deletedAt: null },
  });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  // Get active checklist items from Checklist Master (BRD §7.1)
  const checklistMaster = await prisma.checklistMaster.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { id: 'asc' },
  });

  const record = await prisma.$transaction(async (tx) => {
    const joining = await tx.candidateJoining.create({
      data: {
        candidateId: parsed.data.candidateId,
        offerLetterId: parsed.data.offerLetterId ?? null,
        joiningDate: parsed.data.joiningDate ?? null,
        actualJoiningDate: parsed.data.actualJoiningDate ?? null,
        joiningStatus: 'Joining Pending',
        remarks: parsed.data.remarks ?? null,
      },
      include,
    });

    // Initialize checklist items from master (BRD §7.1)
    if (checklistMaster.length > 0) {
      await tx.candidateChecklistItem.createMany({
        data: checklistMaster.map((cm) => ({
          candidateId: parsed.data.candidateId,
          checklistMasterId: cm.id,
          status: 'Not Received',
        })),
      });
    }

    return joining;
  });

  // Update candidate status to JOINING_PENDING
  const joiningStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'JOINING_PENDING' } });
  if (joiningStatus) {
    await prisma.$transaction([
      prisma.candidate.update({ where: { id: candidate.id }, data: { currentStatusId: joiningStatus.id } }),
      prisma.candidateActivityLog.create({
        data: {
          candidateId: candidate.id,
          action: `Joining initiated — planned ${parsed.data.joiningDate ? new Date(parsed.data.joiningDate).toLocaleDateString() : 'TBD'}`,
          toStatus: 'JOINING_PENDING',
        },
      }),
    ]);
  }

  return NextResponse.json(record, { status: 201 });
}
