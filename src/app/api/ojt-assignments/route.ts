import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ojtAssignmentSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId') ?? '';

  const data = await prisma.ojtAssignment.findMany({
    where: { companyId, deletedAt: null, ...(employeeId ? { employeeId: parseInt(employeeId) } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = ojtAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.ojtAssignment.create({
    data: { ...parsed.data, companyId },
  });
  await auditLearning(companyId, actor, 'OjtAssignment', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
