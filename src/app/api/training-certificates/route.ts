/**
 * Training certificates (BRD §33, §10).
 *
 * GET  ?employeeId=  → list certificates (optionally per employee)
 * POST               → issue a certificate; auto-generates CERT### number
 *                      when not supplied, using the existing master-code pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingCertificateSchema } from '@/lib/validations/learning';
import { nextSequentialCode } from '@/lib/master-code';
import { learningAuth, auditLearning, notifyLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId') ?? '';
  const programId = searchParams.get('programId') ?? '';
  const status = searchParams.get('status') ?? '';
  const expiringDays = searchParams.get('expiringDays') ?? ''; // certs expiring within N days

  const data = await prisma.trainingCertificate.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
      ...(programId ? { trainingProgramId: parseInt(programId) } : {}),
      ...(status ? { status } : {}),
      ...(expiringDays ? { expiryDate: { not: null, lte: new Date(Date.now() + parseInt(expiringDays) * 86400000) } } : {}),
    },
    orderBy: { issueDate: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingCertificateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-generate CERT### when not supplied — same pattern as CMP###/TPR###.
  let certificateNumber = parsed.data.certificateNumber;
  if (!certificateNumber) {
    const existing = await prisma.trainingCertificate.findMany({
      where: { companyId },
      select: { certificateNumber: true },
    });
    certificateNumber = nextSequentialCode(existing.map((r) => r.certificateNumber), 'CERT', 4);
  } else {
    const dup = await prisma.trainingCertificate.findFirst({
      where: { companyId, certificateNumber },
    });
    if (dup) return NextResponse.json({ error: 'Certificate number already exists' }, { status: 409 });
  }

  const record = await prisma.trainingCertificate.create({
    data: {
      ...parsed.data,
      certificateNumber,
      companyId,
      issuedByUserId: actor.userId,
      issueDate: parsed.data.issueDate ?? new Date(),
    },
  });

  await auditLearning(companyId, actor, 'TrainingCertificate', record.id, 'CREATE', null, record, `Issued ${certificateNumber}`);
  notifyLearning(companyId, 'TRAINING_COMPLETED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'TrainingCertificate',
    sourceEntityId: record.id,
    subjectEmpId: record.employeeId,
    linkPath: '/ess/my-trainings',
    data: { Certificate: { Number: certificateNumber } },
  });
  return NextResponse.json(record, { status: 201 });
}
