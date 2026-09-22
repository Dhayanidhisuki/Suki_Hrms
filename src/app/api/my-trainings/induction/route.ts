/**
 * ESS induction self-service (BRD §23).
 *
 * GET   /api/my-trainings/induction            → my induction assignments + program + checklist state
 * PATCH /api/my-trainings/induction            → { assignmentId, action }
 *        action=CONFIRM                → employee confirms induction done
 *        action=CHECK_ITEM { index }   → employee ticks a checklist topic
 *        action=START                  → mark PENDING → IN_PROGRESS
 *
 * Employee-scoped: assignments are resolved via the logged-in user's employee
 * record — no cross-employee access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { auditLearning } from '@/lib/learning/shared';

async function ownScope(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return { error: companyCheck.error };
  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return { error: NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 }) };
  }
  return { companyId: companyCheck.companyId, employeeId, userId };
}

export async function GET(request: NextRequest) {
  const scope = await ownScope(request);
  if ('error' in scope && scope.error) return scope.error;
  const { companyId, employeeId } = scope as { companyId: number; employeeId: number };

  const assignments = await prisma.inductionAssignment.findMany({
    where: { companyId, employeeId, deletedAt: null },
    include: { program: { select: { id: true, name: true, durationDays: true, topicsJson: true, description: true } } },
    orderBy: { assignedDate: 'desc' },
  });

  return NextResponse.json({ data: assignments });
}

export async function PATCH(request: NextRequest) {
  const scope = await ownScope(request);
  if ('error' in scope && scope.error) return scope.error;
  const { companyId, employeeId, userId } = scope as { companyId: number; employeeId: number; userId: number };

  const body = await request.json().catch(() => null);
  const assignmentId = Number(body?.assignmentId);
  const action = String(body?.action ?? '').toUpperCase();
  if (!assignmentId || !action) {
    return NextResponse.json({ error: 'assignmentId and action are required' }, { status: 400 });
  }

  // Strictly employee-owned rows only.
  const existing = await prisma.inductionAssignment.findFirst({
    where: { id: assignmentId, companyId, employeeId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const actor = {
    userId,
    employeeId,
    source: 'user' as const,
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
  };

  if (action === 'START') {
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: `Assignment is ${existing.status}` }, { status: 409 });
    }
    const record = await prisma.inductionAssignment.update({
      where: { id: assignmentId },
      data: { status: 'IN_PROGRESS' },
    });
    await auditLearning(companyId, actor, 'InductionAssignment', assignmentId, 'START', existing, record);
    return NextResponse.json(record);
  }

  if (action === 'CHECK_ITEM') {
    const index = Number(body?.index);
    let items: { topic?: string; done?: boolean; date?: string | null }[] = [];
    try { items = JSON.parse(existing.checklistJson ?? '[]'); } catch { /* ignore */ }
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return NextResponse.json({ error: 'Invalid checklist index' }, { status: 400 });
    }
    items[index] = { ...items[index], done: !items[index].done, date: !items[index].done ? new Date().toISOString() : null };
    const allDone = items.length > 0 && items.every((i) => i.done);
    const record = await prisma.inductionAssignment.update({
      where: { id: assignmentId },
      data: {
        checklistJson: JSON.stringify(items),
        status: allDone ? 'IN_PROGRESS' : existing.status === 'PENDING' ? 'IN_PROGRESS' : existing.status,
      },
    });
    await auditLearning(companyId, actor, 'InductionAssignment', assignmentId, 'CHECK_ITEM', existing, record, `Item ${index} ${items[index].done ? 'checked' : 'unchecked'}`);
    return NextResponse.json(record);
  }

  if (action === 'CONFIRM') {
    let items: { done?: boolean }[] = [];
    try { items = JSON.parse(existing.checklistJson ?? '[]'); } catch { /* ignore */ }
    if (items.length > 0 && !items.every((i) => i.done)) {
      return NextResponse.json({ error: 'Complete all checklist items before confirming' }, { status: 409 });
    }
    const record = await prisma.inductionAssignment.update({
      where: { id: assignmentId },
      data: {
        employeeConfirmed: true,
        confirmedAt: new Date(),
        status: 'COMPLETED',
        completedDate: new Date(),
      },
    });
    await auditLearning(companyId, actor, 'InductionAssignment', assignmentId, 'CONFIRM', existing, record);
    return NextResponse.json(record);
  }

  return NextResponse.json({ error: 'Unknown action. Use START, CHECK_ITEM or CONFIRM.' }, { status: 400 });
}
