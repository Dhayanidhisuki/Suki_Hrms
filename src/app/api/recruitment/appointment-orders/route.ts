/**
 * Appointment Order API — list, create (auto KAPLHR/Appt/YYYY/NNNN).
 * BRD §6.1. Declined → revert candidate to Offer Accepted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appointmentOrderCreateSchema } from '@/lib/validations/recruitment';

const APPT_SEQ_KEY = 'appointment-order';

function formatApptNo(year: number, n: number): string {
  return `KAPLHR/Appt/${year}/${String(n).padStart(4, '0')}`;
}

async function allocateApptNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.employeeIdSequence.upsert({
    where: { counterKey: APPT_SEQ_KEY },
    create: { counterKey: APPT_SEQ_KEY, lastNumber: 0 },
    update: {},
  });
  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const apptNo = formatApptNo(year, n);
    const taken = await prisma.appointmentOrder.findFirst({ where: { apptNo }, select: { id: true } });
    if (!taken) {
      await prisma.employeeIdSequence.update({ where: { counterKey: APPT_SEQ_KEY }, data: { lastNumber: n } });
      return apptNo;
    }
  }
  throw new Error('Could not allocate appointment number');
}

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, email: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  offerLetter: { select: { id: true, offerNo: true, proposedSalary: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = parseInt(candidateId);
  const records = await prisma.appointmentOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include,
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = appointmentOrderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: parsed.data.candidateId, deletedAt: null },
  });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const apptNo = await allocateApptNo();

  const record = await prisma.appointmentOrder.create({
    data: {
      candidateId: parsed.data.candidateId,
      apptNo,
      offerLetterId: parsed.data.offerLetterId ?? null,
      status: 'Draft',
    },
    include,
  });

  // Update candidate status to APPOINTMENT_DRAFT
  const apptStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'APPOINTMENT_DRAFT' } });
  if (apptStatus) {
    await prisma.$transaction([
      prisma.candidate.update({ where: { id: candidate.id }, data: { currentStatusId: apptStatus.id } }),
      prisma.candidateActivityLog.create({
        data: {
          candidateId: candidate.id,
          action: `Appointment order created — ${apptNo}`,
          toStatus: 'APPOINTMENT_DRAFT',
        },
      }),
    ]);
  }

  return NextResponse.json(record, { status: 201 });
}
