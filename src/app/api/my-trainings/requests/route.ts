/**
 * POST /api/my-trainings/requests — §48/§53 Employee Training Request.
 * The logged-in employee raises a training need for themselves; it lands in
 * the normal TNA approval flow (status=SUBMITTED, source=EMPLOYEE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { auditLearning } from '@/lib/learning/shared';
import { z } from 'zod';

const requestSchema = z.object({
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().min(3).max(500),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.competencyId && !parsed.data.trainingProgramId) {
    return NextResponse.json({ error: 'Select a competency or a training program' }, { status: 400 });
  }

  const record = await prisma.trainingNeedRequest.create({
    data: {
      companyId,
      employeeId,
      competencyId: parsed.data.competencyId ?? null,
      trainingProgramId: parsed.data.trainingProgramId ?? null,
      source: 'EMPLOYEE',
      reason: parsed.data.reason,
      priority: parsed.data.priority,
      status: 'SUBMITTED',
    },
  });

  await auditLearning(
    companyId,
    { userId, employeeId, source: 'user', ipAddress: request.headers.get('x-forwarded-for') ?? null },
    'TrainingNeedRequest', record.id, 'CREATE', null, record,
    'Employee self-service training request',
  );
  return NextResponse.json({ data: record }, { status: 201 });
}
