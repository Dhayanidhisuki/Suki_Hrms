/**
 * Induction assignments (BRD §23).
 *
 * GET  ?programId=        → list assignments (optionally per program)
 * POST                    → assign employee to an induction program
 * POST { action:'COMPLETE', id } → mark an assignment completed
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inductionAssignmentSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';
  const status = searchParams.get('status') ?? '';

  const data = await prisma.inductionAssignment.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(programId ? { inductionProgramId: parseInt(programId) } : {}),
      ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { program: { select: { name: true, durationDays: true } } },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();

  // Complete action: mark an assignment done.
  if (body.action === 'COMPLETE' && body.id) {
    const existing = await prisma.inductionAssignment.findFirst({
      where: { id: parseInt(body.id), companyId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const record = await prisma.inductionAssignment.update({
      where: { id: existing.id },
      data: { status: 'COMPLETED', completedDate: new Date() },
    });
    await auditLearning(companyId, actor, 'InductionAssignment', existing.id, 'COMPLETE', existing, record);
    return NextResponse.json(record);
  }

  const parsed = inductionAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Block inactive/terminated employees (BRD §51).
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (employee.status && /terminat|inact|exit|resign/i.test(employee.status)) {
    return NextResponse.json({ error: 'Cannot assign induction to an inactive/terminated employee' }, { status: 400 });
  }

  // No duplicate assignment.
  const dup = await prisma.inductionAssignment.findFirst({
    where: { companyId, inductionProgramId: parsed.data.inductionProgramId, employeeId: parsed.data.employeeId, deletedAt: null },
  });
  if (dup) return NextResponse.json({ error: 'Employee already assigned to this induction program' }, { status: 409 });

  const record = await prisma.inductionAssignment.create({
    data: { ...parsed.data, companyId },
  });
  await auditLearning(companyId, actor, 'InductionAssignment', record.id, 'CREATE', null, record);
  notifyLearning(companyId, 'TRAINING_SCHEDULED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'InductionAssignment',
    sourceEntityId: record.id,
    subjectEmpId: record.employeeId,
    linkPath: '/ess/my-trainings',
    data: { Training: { Program: 'Induction Program', Date: record.targetDate ?? null } },
  });
  return NextResponse.json(record, { status: 201 });
}
