/**
 * Joining Approval — POST /api/recruitment/candidate-joinings/:id/approval
 * BRD §8. Routes through Joining Approval Matrix; approves/rejects/holds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { joiningApprovalSchema } from '@/lib/validations/recruitment';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const joiningId = parseInt(id);
  const body = await request.json();
  const parsed = joiningApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const joining = await prisma.candidateJoining.findUnique({
    where: { id: joiningId },
    include: { candidate: { include: { department: true, designation: true } } },
  });
  if (!joining) return NextResponse.json({ error: 'Joining not found' }, { status: 404 });

  const newJoiningStatus = parsed.data.action === 'Approved' ? 'Joined' : parsed.data.action === 'Rejected' ? 'Rejected' : 'Joining Approval';

  const record = await prisma.$transaction([
    prisma.candidateJoining.update({
      where: { id: joiningId },
      data: {
        joiningStatus: newJoiningStatus,
        approvalStatus: parsed.data.action === 'Approved' ? 'Approved' : parsed.data.action === 'Rejected' ? 'Rejected' : 'Pending',
        approvedAt: parsed.data.action === 'Approved' ? new Date() : null,
        approvalRemarks: parsed.data.remarks ?? null,
      },
    }),
    prisma.candidateActivityLog.create({
      data: {
        candidateId: joining.candidateId,
        action: `Joining ${parsed.data.action}`,
        remarks: parsed.data.remarks ?? null,
      },
    }),
  ]);

  // If approved, update candidate status to JOINING_APPROVED
  if (parsed.data.action === 'Approved') {
    const approvedStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'JOINING_APPROVED' } });
    if (approvedStatus) {
      await prisma.candidate.update({
        where: { id: joining.candidateId },
        data: { currentStatusId: approvedStatus.id },
      });
    }
  }

  return NextResponse.json({ message: `Joining ${parsed.data.action}`, joining: record[0] });
}
