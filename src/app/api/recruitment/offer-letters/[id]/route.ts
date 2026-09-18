/**
 * Offer Letter [id] — GET, PATCH (status update), DELETE.
 * BRD §5.15. Status flow: Draft → Generated → Sent → Accepted / Rejected / Expired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { offerLetterStatusSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, email: true, mobile: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  offerTemplate: { select: { id: true, templateName: true, templateCode: true } },
  reportingManager: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.offerLetter.findUnique({ where: { id: parseInt(id) }, include });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = offerLetterStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.offerLetter.findUnique({ where: { id: parseInt(id) }, include: { candidate: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === 'Sent') updateData.sentAt = new Date();
  if (parsed.data.status === 'Accepted') updateData.acceptedAt = new Date();
  if (parsed.data.status === 'Expired') updateData.expiredAt = new Date();
  if (parsed.data.remarks) updateData.remarks = parsed.data.remarks;

  const record = await prisma.offerLetter.update({
    where: { id: parseInt(id) },
    data: updateData,
    include,
  });

  // Update candidate status based on offer status
  const statusMap: Record<string, string> = {
    'Sent': 'OFFER_SENT',
    'Accepted': 'OFFER_ACCEPTED',
    'Rejected': 'OFFER_REJECTED',
    'Expired': 'OFFER_REJECTED',
  };
  const candidateStatusCode = statusMap[parsed.data.status];
  if (candidateStatusCode && existing.candidate) {
    const newStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: candidateStatusCode } });
    if (newStatus) {
      await prisma.$transaction([
        prisma.candidate.update({ where: { id: existing.candidate.id }, data: { currentStatusId: newStatus.id } }),
        prisma.candidateActivityLog.create({
          data: {
            candidateId: existing.candidate.id,
            action: `Offer ${parsed.data.status} — ${existing.offerNo}`,
            toStatus: candidateStatusCode,
            remarks: parsed.data.remarks ?? null,
          },
        }),
      ]);
    }
  }

  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.offerLetter.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
