/**
 * Internship API — list, create with auto intern ID (BRD §6.2).
 * GET  /api/recruitment/internships?candidateId=
 * POST /api/recruitment/internships
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { internshipSchema } from '@/lib/validations/recruitment';

const INTERN_SEQ_KEY = 'internship';

async function allocateInternId(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.employeeIdSequence.upsert({
    where: { counterKey: INTERN_SEQ_KEY },
    create: { counterKey: INTERN_SEQ_KEY, lastNumber: 0 },
    update: {},
  });
  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const internId = `INT-${year}-${String(n).padStart(4, '0')}`;
    const taken = await prisma.internship.findFirst({ where: { internId }, select: { id: true } });
    if (!taken) {
      await prisma.employeeIdSequence.update({ where: { counterKey: INTERN_SEQ_KEY }, data: { lastNumber: n } });
      return internId;
    }
  }
  throw new Error('Could not allocate intern ID');
}

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true } },
  department: { select: { id: true, name: true } },
  mentor: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  policy: { select: { id: true, policyName: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = parseInt(candidateId);
  const records = await prisma.internship.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include,
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = internshipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({ where: { id: parsed.data.candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const internId = await allocateInternId();

  const record = await prisma.internship.create({
    data: {
      internId,
      candidateId: parsed.data.candidateId,
      college: parsed.data.college ?? null,
      regNo: parsed.data.regNo ?? null,
      course: parsed.data.course ?? null,
      departmentId: parsed.data.departmentId ?? null,
      mentorId: parsed.data.mentorId ?? null,
      trainingStart: parsed.data.trainingStart,
      trainingEnd: parsed.data.trainingEnd,
      stipend: parsed.data.stipend ?? null,
      policyId: parsed.data.policyId ?? null,
      status: 'Applied',
    },
    include,
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: parsed.data.candidateId,
      action: `Internship created — ${internId}`,
      toStatus: 'INTERNSHIP',
    },
  });

  return NextResponse.json(record, { status: 201 });
}
