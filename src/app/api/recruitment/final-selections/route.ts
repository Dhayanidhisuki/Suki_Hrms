/**
 * Final Selection API — propose salary/joining/employment type (BRD §5.14).
 * No separate model — stored as a Draft OfferLetter. The Recruitment Approval
 * Matrix is consulted to set the approval status.
 *
 * GET  /api/recruitment/final-selections?candidateId=
 * POST /api/recruitment/final-selections  — create proposal (Draft OfferLetter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { finalSelectionSchema } from '@/lib/validations/recruitment';
import { allocateOfferNo } from '@/lib/recruitment/offer-sequence';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, department: { select: { id: true, name: true } }, designation: { select: { id: true, name: true } } } },
  reportingManager: { select: { id: true, firstName: true, lastName: true } },
  offerTemplate: { select: { id: true, templateName: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const where: Record<string, unknown> = { status: 'Draft' };
  if (candidateId) where.candidateId = parseInt(candidateId);
  const records = await prisma.offerLetter.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include,
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = finalSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: parsed.data.candidateId, deletedAt: null },
    include: { department: true, designation: true },
  });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  // Look up the Recruitment Approval Matrix for this department
  const approvalMatrix = await prisma.recruitmentApprovalMatrix.findFirst({
    where: {
      isActive: true,
      OR: [
        { departmentId: candidate.departmentId ?? -1 },
        { departmentId: null },
      ],
    },
    orderBy: { departmentId: 'desc' },
  });

  const offerNo = await allocateOfferNo();

  const record = await prisma.offerLetter.create({
    data: {
      candidateId: parsed.data.candidateId,
      offerNo,
      status: 'Draft',
      proposedSalary: parsed.data.proposedSalary,
      joiningDate: parsed.data.joiningDate,
      employmentType: parsed.data.employmentType,
      reportingManagerId: parsed.data.reportingManagerId ?? null,
      remarks: parsed.data.remarks ?? null,
    },
    include,
  });

  // Update candidate status to FINAL_APPROVAL
  const finalStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'FINAL_APPROVAL' } });
  if (finalStatus) {
    const fromStatus = candidate.currentStatusId
      ? (await prisma.recruitmentStatus.findUnique({ where: { id: candidate.currentStatusId } }))?.statusCode ?? null
      : null;
    await prisma.$transaction([
      prisma.candidate.update({ where: { id: candidate.id }, data: { currentStatusId: finalStatus.id } }),
      prisma.candidateActivityLog.create({
        data: {
          candidateId: candidate.id,
          action: `Final selection proposed — ${parsed.data.employmentType}, ${parsed.data.proposedSalary}`,
          fromStatus,
          toStatus: 'FINAL_APPROVAL',
          remarks: parsed.data.remarks ?? null,
        },
      }),
    ]);
  }

  return NextResponse.json({ ...record, approvalMatrix: approvalMatrix ? { id: approvalMatrix.id, process: approvalMatrix.process } : null }, { status: 201 });
}
