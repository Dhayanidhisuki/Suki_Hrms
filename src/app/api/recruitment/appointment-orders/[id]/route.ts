/**
 * Appointment Order [id] — GET, PATCH (status), DELETE.
 * BRD §6.1. Declined → revert candidate to Offer Accepted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appointmentStatusSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, email: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  offerLetter: { select: { id: true, offerNo: true, proposedSalary: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.appointmentOrder.findUnique({ where: { id: parseInt(id) }, include });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = appointmentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.appointmentOrder.findUnique({ where: { id: parseInt(id) }, include: { candidate: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === 'Sent') updateData.sentAt = new Date();
  if (parsed.data.status === 'Accepted') updateData.acceptedAt = new Date();
  if (parsed.data.status === 'Declined') updateData.declinedAt = new Date();
  if (parsed.data.remarks) updateData.remarks = parsed.data.remarks;

  const record = await prisma.appointmentOrder.update({
    where: { id: parseInt(id) },
    data: updateData,
    include,
  });

  // Status mapping
  const statusMap: Record<string, string> = {
    'Sent': 'APPOINTMENT_ISSUED',
    'Accepted': 'APPOINTMENT_ACCEPTED',
    'Declined': 'OFFER_ACCEPTED', // revert to offer pending
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
            action: `Appointment ${parsed.data.status} — ${existing.apptNo}`,
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
  await prisma.appointmentOrder.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
