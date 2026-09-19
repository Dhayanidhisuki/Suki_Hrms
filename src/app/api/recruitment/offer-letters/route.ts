/**
 * Offer Letter API — list, create (with template render + auto offer number),
 * status update (Draft → Generated → Sent → Accepted/Rejected/Expired) (BRD §5.15).
 *
 * GET  /api/recruitment/offer-letters?candidateId=
 * POST /api/recruitment/offer-letters
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { offerLetterCreateSchema, offerLetterStatusSchema } from '@/lib/validations/recruitment';
import { allocateOfferNo, renderTemplate } from '@/lib/recruitment/offer-sequence';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, email: true, mobile: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  offerTemplate: { select: { id: true, templateName: true, templateCode: true } },
  reportingManager: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const where: Record<string, unknown> = {};
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
  const parsed = offerLetterCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: parsed.data.candidateId, deletedAt: null },
    include: { department: true, designation: true },
  });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const offerNo = await allocateOfferNo();

  const record = await prisma.offerLetter.create({
    data: {
      candidateId: parsed.data.candidateId,
      offerNo,
      offerTemplateId: parsed.data.offerTemplateId ?? null,
      status: 'Generated',
      proposedSalary: parsed.data.proposedSalary,
      joiningDate: parsed.data.joiningDate,
      employmentType: parsed.data.employmentType,
      reportingManagerId: parsed.data.reportingManagerId ?? null,
      locationId: parsed.data.locationId ?? null,
      probationMonths: parsed.data.probationMonths,
      remarks: parsed.data.remarks ?? null,
    },
    include,
  });

  // Update candidate status to OFFER_SENT (or OFFER_DRAFT)
  const offerStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'OFFER_SENT' } });
  if (offerStatus) {
    await prisma.$transaction([
      prisma.candidate.update({ where: { id: candidate.id }, data: { currentStatusId: offerStatus.id } }),
      prisma.candidateActivityLog.create({
        data: {
          candidateId: candidate.id,
          action: `Offer letter generated — ${offerNo}`,
          toStatus: 'OFFER_SENT',
        },
      }),
    ]);
  }

  return NextResponse.json(record, { status: 201 });
}
