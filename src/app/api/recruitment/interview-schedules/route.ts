/**
 * Interview Schedule API — list (filter by candidate/interviewer/status) + create.
 * BRD §5.7, §5.9. On create, snapshots the criteria+weightage config so future
 * master edits don't alter historical evaluations (BRD §15.2).
 *
 * GET  /api/recruitment/interview-schedules?candidateId=&interviewerId=&status=&page=&limit=
 * POST /api/recruitment/interview-schedules
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { interviewScheduleCreateSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, mobile: true, email: true } },
  interviewLevel: { select: { id: true, levelName: true, levelCode: true } },
  interviewType: { select: { id: true, typeName: true, typeCode: true } },
  interviewer: { select: { id: true, firstName: true, lastName: true } },
  evaluations: { include: { criteria: { select: { id: true, criteriaName: true } } } },
  evaluationSummary: true,
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const candidateId = searchParams.get('candidateId');
  const interviewerId = searchParams.get('interviewerId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = parseInt(candidateId);
  if (interviewerId) where.interviewerId = parseInt(interviewerId);
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.interviewSchedule.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { scheduledDate: 'desc' },
      include,
    }),
    prisma.interviewSchedule.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = interviewScheduleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({ where: { id: parsed.data.candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  // Snapshot the criteria config for this level+type (BRD §15.2)
  const criteriaConfigs = await prisma.interviewScoreConfig.findMany({
    where: {
      interviewLevelId: parsed.data.interviewLevelId,
      interviewTypeId: parsed.data.interviewTypeId,
      isActive: true,
      // Match by department/designation if candidate has them, else global
      OR: [
        { departmentId: candidate.departmentId ?? -1, designationId: candidate.designationId ?? -1 },
        { departmentId: null, designationId: null },
      ],
    },
    include: { criteria: true },
  });

  const processSnapshot = JSON.stringify({
    capturedAt: new Date().toISOString(),
    criteria: criteriaConfigs.map((c) => ({
      criteriaId: c.criteriaId,
      criteriaName: c.criteria?.criteriaName,
      maxScore: Number(c.maxScore),
      minScore: Number(c.minScore),
      weightage: Number(c.weightage),
      passingScore: Number(c.passingScore),
      ratingScale: c.ratingScale,
    })),
  });

  const record = await prisma.interviewSchedule.create({
    data: {
      ...parsed.data,
      endTime: parsed.data.endTime ?? null,
      locationOrLink: parsed.data.locationOrLink ?? null,
      status: 'Scheduled',
      processSnapshot,
    },
    include,
  });

  // Update candidate status to INTERVIEW_SCHEDULED
  const interviewStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'INTERVIEW_SCHEDULED' } });
  if (interviewStatus && candidate.currentStatusId !== interviewStatus.id) {
    const fromStatus = candidate.currentStatusId
      ? (await prisma.recruitmentStatus.findUnique({ where: { id: candidate.currentStatusId } }))?.statusCode ?? null
      : null;
    await prisma.$transaction([
      prisma.candidate.update({ where: { id: candidate.id }, data: { currentStatusId: interviewStatus.id } }),
      prisma.candidateActivityLog.create({
        data: {
          candidateId: candidate.id,
          action: `Interview scheduled — ${record.interviewLevel?.levelName ?? ''}`,
          fromStatus,
          toStatus: 'INTERVIEW_SCHEDULED',
          remarks: `${new Date(parsed.data.scheduledDate).toLocaleDateString()} ${parsed.data.startTime}`,
        },
      }),
    ]);
  }

  return NextResponse.json(record, { status: 201 });
}
