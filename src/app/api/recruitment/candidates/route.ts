/**
 * Candidate API — list (with filters) + create (with duplicate check).
 * BRD §5.3, §5.2.
 *
 * GET  /api/recruitment/candidates?page=&limit=&search=&departmentId=&designationId=&statusId=&jobPostingId=&sourceChannelId=
 * POST /api/recruitment/candidates  — create (auto applicationNo, duplicate check on mobile/email/aadhaar)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateCreateSchema } from '@/lib/validations/recruitment';
import { allocateApplicationNo } from '@/lib/recruitment/candidate-sequence';

const candidateInclude = {
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true, code: true } },
  jobPosting: { select: { id: true, title: true } },
  sourceChannel: { select: { id: true, channelName: true } },
  currentStatus: { select: { id: true, statusCode: true, statusName: true, color: true } },
  createdBy: { select: { id: true, email: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const departmentId = searchParams.get('departmentId');
  const designationId = searchParams.get('designationId');
  const statusId = searchParams.get('statusId');
  const jobPostingId = searchParams.get('jobPostingId');
  const sourceChannelId = searchParams.get('sourceChannelId');

  const where: Record<string, unknown> = { deletedAt: null };
  if (search) {
    where.OR = [
      { applicationNo: { contains: search } },
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { mobile: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (departmentId) where.departmentId = parseInt(departmentId);
  if (designationId) where.designationId = parseInt(designationId);
  if (statusId) where.currentStatusId = parseInt(statusId);
  if (jobPostingId) where.jobPostingId = parseInt(jobPostingId);
  if (sourceChannelId) where.sourceChannelId = parseInt(sourceChannelId);

  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: candidateInclude,
    }),
    prisma.candidate.count({ where }),
  ]);

  return NextResponse.json({
    data: data.map((c) => ({
      ...c,
      fullName: `${c.firstName} ${c.lastName}`,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = candidateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { acknowledgeDuplicate, ...data } = parsed.data;

  // Duplicate check — soft warning on mobile, email, aadhaar (BRD §5.3)
  const duplicates = await prisma.candidate.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(data.mobile ? [{ mobile: data.mobile }] : []),
        ...(data.email ? [{ email: data.email }] : []),
        ...(data.aadhaar ? [{ aadhaar: data.aadhaar }] : []),
      ],
    },
    select: { id: true, applicationNo: true, firstName: true, lastName: true, mobile: true, email: true },
  });

  if (duplicates.length > 0 && !acknowledgeDuplicate) {
    return NextResponse.json(
      {
        duplicateWarning: true,
        message: `Duplicate candidate(s) found: ${duplicates.map((d) => d.applicationNo).join(', ')} — continue anyway?`,
        duplicates,
      },
      { status: 409 }
    );
  }

  // Get the initial status (NEW)
  const newStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'NEW' } });
  if (!newStatus) {
    return NextResponse.json({ error: 'RecruitmentStatus "NEW" not found — run seed script' }, { status: 500 });
  }

  const applicationNo = await allocateApplicationNo();

  const record = await prisma.candidate.create({
    data: {
      ...data,
      applicationNo,
      currentStatusId: newStatus.id,
      dateOfBirth: data.dateOfBirth ?? null,
      aadhaar: data.aadhaar ?? null,
    },
    include: candidateInclude,
  });

  // Log activity
  await prisma.candidateActivityLog.create({
    data: {
      candidateId: record.id,
      action: 'Candidate registered',
      toStatus: 'NEW',
      remarks: `Application ${applicationNo} created`,
    },
  });

  return NextResponse.json({ ...record, fullName: `${record.firstName} ${record.lastName}` }, { status: 201 });
}
