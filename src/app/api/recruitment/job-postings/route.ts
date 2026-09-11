/**
 * GET  /api/recruitment/job-postings — list (optional jdId filter)
 * POST /api/recruitment/job-postings — create; Attach JD from Active JD Master
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { jobPostingCreateSchema } from '@/lib/validations/jd-master';

const postingInclude = {
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true, code: true } },
  jobDescription: { select: { id: true, jdCode: true, title: true, status: true } },
  createdBy: { select: { id: true, email: true } },
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
  const jdId = searchParams.get('jdId') ? Number(searchParams.get('jdId')) : undefined;
  const search = searchParams.get('search')?.trim();

  const where = {
    deletedAt: null,
    ...(jdId && !Number.isNaN(jdId) ? { jdId } : {}),
    ...(search ? { title: { contains: search } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: postingInclude,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const createdByUserId = Number(request.headers.get('x-user-id')) || null;

  const parsed = jobPostingCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.jdId) {
    const jd = await prisma.jobDescription.findFirst({
      where: { id: parsed.data.jdId, deletedAt: null, status: 'Active' },
      select: { id: true, departmentId: true, designationId: true, title: true },
    });
    if (!jd) return NextResponse.json({ error: 'Attach only an Active JD from JD Master' }, { status: 400 });
    // Default department/designation from the JD when the client omitted them.
    const record = await prisma.jobPosting.create({
      data: {
        title: parsed.data.title,
        departmentId: parsed.data.departmentId ?? jd.departmentId,
        designationId: parsed.data.designationId ?? jd.designationId,
        jdId: jd.id,
        status: parsed.data.status ?? 'Open',
        createdByUserId,
      },
      include: postingInclude,
    });
    return NextResponse.json(record, { status: 201 });
  }

  const record = await prisma.jobPosting.create({
    data: {
      title: parsed.data.title,
      departmentId: parsed.data.departmentId ?? null,
      designationId: parsed.data.designationId ?? null,
      jdId: null,
      status: parsed.data.status ?? 'Open',
      createdByUserId,
    },
    include: postingInclude,
  });
  return NextResponse.json(record, { status: 201 });
}
