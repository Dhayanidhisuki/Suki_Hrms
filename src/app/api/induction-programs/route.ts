import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inductionProgramSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const data = await prisma.inductionProgram.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { assignments: { where: { deletedAt: null } } } } },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = inductionProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.inductionProgram.create({
    data: { ...parsed.data, companyId },
  });
  await auditLearning(companyId, actor, 'InductionProgram', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
