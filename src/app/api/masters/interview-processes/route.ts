/**
 * Interview Process API — custom (not using crud-factory) because it has
 * child InterviewProcessLevel rows that need to be managed together.
 *
 * GET  /api/masters/interview-processes        — list (paginated + search)
 * POST /api/masters/interview-processes        — create process (with levels)
 * GET  /api/masters/interview-processes/:id    — get process (with levels)
 * PUT  /api/masters/interview-processes/:id    — update process (with levels)
 * DELETE /api/masters/interview-processes/:id  — soft-delete process
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { interviewProcessSchema } from '@/lib/validations/recruitment';
import { z } from 'zod';

const processLevelSchema = z.object({
  interviewLevelId: z.coerce.number().int().positive(),
  interviewTypeId: z.coerce.number().int().positive(),
  sequence: z.coerce.number().int().min(0),
  mandatory: z.boolean().default(true),
  passScore: z.coerce.number().min(0).max(100).optional().nullable(),
});

const createProcessSchema = interviewProcessSchema.extend({
  levels: z.array(processLevelSchema).default([]),
});

const includeLevels = { levels: { include: { interviewLevel: true, interviewType: true } } };

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  // 'active' | 'inactive'; anything else (including absent) means no filter,
  // so an existing caller that never sends it keeps seeing every row.
  const status = searchParams.get('status');

  const where: Prisma.InterviewProcessWhereInput = {
    deletedAt: null,
    ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    ...(search ? { OR: [{ processName: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.interviewProcess.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { department: true, designation: true, ...includeLevels },
    }),
    prisma.interviewProcess.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = createProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { levels, ...processData } = parsed.data;
  const record = await prisma.interviewProcess.create({
    data: {
      ...processData,
      levels: { create: levels },
    },
    include: includeLevels,
  });
  return NextResponse.json(record, { status: 201 });
}
