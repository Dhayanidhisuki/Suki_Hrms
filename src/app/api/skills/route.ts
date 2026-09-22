import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { skillSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? '';

  const data = await prisma.skill.findMany({
    where: { companyId, deletedAt: null, ...(category ? { category } : {}) },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = skillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.skill.create({ data: { ...parsed.data, companyId } });
  await auditLearning(companyId, actor, 'Skill', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
