/**
 * Internship [id] — GET, PATCH (status), DELETE (BRD §6.2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { internshipStatusSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true } },
  department: { select: { id: true, name: true } },
  mentor: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  policy: { select: { id: true, policyName: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.internship.findUnique({ where: { id: parseInt(id) }, include });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = internshipStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.internship.findUnique({ where: { id: parseInt(id) } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const record = await prisma.internship.update({
    where: { id: parseInt(id) },
    data: { status: parsed.data.status },
    include,
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: existing.candidateId,
      action: `Internship ${parsed.data.status} — ${existing.internId}`,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.internship.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
