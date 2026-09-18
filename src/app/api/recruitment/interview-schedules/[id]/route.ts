/**
 * Interview Schedule [id] — GET, PUT (update), DELETE, PATCH (status change).
 * BRD §5.7, §5.9.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { interviewScheduleUpdateSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, mobile: true, email: true } },
  interviewLevel: { select: { id: true, levelName: true, levelCode: true } },
  interviewType: { select: { id: true, typeName: true, typeCode: true } },
  interviewer: { select: { id: true, firstName: true, lastName: true } },
  evaluations: { include: { criteria: { select: { id: true, criteriaName: true } } } },
  evaluationSummary: true,
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.interviewSchedule.findUnique({ where: { id: parseInt(id) }, include });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = interviewScheduleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const record = await prisma.interviewSchedule.update({
    where: { id: parseInt(id) },
    data: parsed.data,
    include,
  });
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Quick status change (e.g. mark Completed, Cancelled)
  const { id } = await params;
  const { status } = await request.json();
  if (!['Pending', 'Scheduled', 'Completed', 'Cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const record = await prisma.interviewSchedule.update({
    where: { id: parseInt(id) },
    data: { status },
    include,
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.interviewSchedule.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
