import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { idpSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning } from '@/lib/learning/shared';

// GET /api/idp — Individual Development Plans (BRD §48/§53).
export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status');

  const data = await prisma.individualDevelopmentPlan.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = idpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.individualDevelopmentPlan.create({ data: { ...parsed.data, companyId } });
  await auditLearning(companyId, actor, 'IndividualDevelopmentPlan', record.id, 'CREATE', null, record);
  notifyLearning(companyId, 'TNA_SUBMITTED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'IndividualDevelopmentPlan',
    sourceEntityId: record.id,
    subjectEmpId: record.employeeId,
    linkPath: '/learning/operations',
    data: { Request: { Source: 'IDP', Priority: 'NORMAL' } },
  });
  return NextResponse.json(record, { status: 201 });
}
