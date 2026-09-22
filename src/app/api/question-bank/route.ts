import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { questionBankSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId') ?? '';

  const data = await prisma.questionBank.findMany({
    where: { companyId, deletedAt: null, ...(groupId ? { groupId: parseInt(groupId) } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = questionBankSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.questionBank.create({
    data: { ...parsed.data, companyId, groupId: parsed.data.groupId ?? null },
  });

  await auditLearning(companyId, actor, 'QuestionBank', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
