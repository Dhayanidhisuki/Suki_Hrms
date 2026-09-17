import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { createGoalSetSchema } from '@/lib/validations/performance';
import { canManageGoalsFor, isGoalOwner, resolveActor } from '@/lib/performance/access';

/**
 * BRD §17 — employee goal sets.
 *
 * GET scopes itself to what the caller may see: HR sees the company, a
 * manager sees their reports, an employee sees only their own.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const cycleId = sp.get('cycleId');
    const status = sp.get('status');
    const mine = sp.get('mine') === 'true';
    const forEmployee = sp.get('employeeId');

    let employeeFilter: object = {};
    if (forEmployee) {
      // Asking for one named employee (the Employee Master KPI/KRA tab).
      // Allowed for HR, that employee's manager, or the employee themselves —
      // never a bare id lookup, which would leak another team's goals.
      const employeeId = Number(forEmployee);
      const mayView =
        isGoalOwner(actor, employeeId) || (await canManageGoalsFor(actor, scope.companyId, employeeId));
      if (!mayView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      employeeFilter = { employeeId };
    } else if (mine || (!actor.isHr && actor.employeeId == null)) {
      employeeFilter = { employeeId: actor.employeeId ?? -1 };
    } else if (!actor.isHr) {
      const reports = await prisma.employee.findMany({
        where: {
          companyId: scope.companyId,
          OR: [{ reportingManagerId: actor.employeeId }, { secondReportingManagerId: actor.employeeId }],
        },
        select: { id: true },
      });
      // A manager also sees their own set alongside their team's.
      employeeFilter = { employeeId: { in: [...reports.map((r) => r.id), actor.employeeId ?? -1] } };
    }

    const sets = await prisma.employeeGoalSet.findMany({
      where: {
        companyId: scope.companyId,
        ...employeeFilter,
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        cycle: { select: { id: true, code: true, name: true, status: true } },
        _count: { select: { kras: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Employee is relation-free from EmployeeGoalSet (company-scoped tables
    // in this schema don't relate), so decorate names in a second query.
    const employees = await prisma.employee.findMany({
      where: { id: { in: sets.map((s) => s.employeeId) } },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });
    const byId = new Map(employees.map((e) => [e.id, e]));

    const data = sets.map((s) => ({
      ...s,
      employee: byId.get(s.employeeId) ?? null,
    }));

    return NextResponse.json({
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    });
  } catch (err) {
    console.error('[performance/goals] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load goal sets' }, { status: 500 });
  }
}

/** Create an empty DRAFT goal set for an employee in a cycle. */
export async function POST(request: NextRequest) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const parsed = createGoalSetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { employeeId, cycleId } = parsed.data;

    if (!(await canManageGoalsFor(actor, scope.companyId, employeeId))) {
      return NextResponse.json({ error: 'Forbidden — you do not manage this employee' }, { status: 403 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: scope.companyId },
      select: { id: true },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: scope.companyId },
      select: { id: true, status: true },
    });
    if (!cycle) return NextResponse.json({ error: 'Performance cycle not found' }, { status: 404 });
    // BRD §7: closed cycles are read-only; a draft cycle isn't open for goals yet.
    if (cycle.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Goals can only be assigned in an Active cycle (this one is ${cycle.status})` }, { status: 409 });
    }

    const existing = await prisma.employeeGoalSet.findFirst({
      where: { companyId: scope.companyId, employeeId, cycleId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'This employee already has goals for this cycle', goalSetId: existing.id }, { status: 409 });
    }

    const row = await prisma.employeeGoalSet.create({
      data: { companyId: scope.companyId, employeeId, cycleId, assignedByUserId: actor.userId },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[performance/goals] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create goal set' }, { status: 500 });
  }
}
