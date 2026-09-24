/**
 * GET /api/reports/performance/goal-coverage?cycleId=&departmentId=&status=&q=
 *
 * Goal assignment coverage for one performance cycle: one row per employee
 * who should have goals, showing whether they do and where the set has
 * stalled. The point of the report is the employees with NO row in
 * EmployeeGoalSet, so the query is driven from the employee population and
 * left-joined onto goal sets — not the other way round.
 *
 * Population rule: active, non-deleted employees in the actor's scope, minus
 * anyone whose join date falls after the cycle end. Someone who joined in
 * month eleven of a cycle was never eligible for it, and counting them as a
 * coverage gap would make every cycle look permanently incomplete. Those
 * employees are counted and reported separately rather than silently dropped.
 *
 * Read-only. It reports stored statuses and never advances a workflow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveActor } from '@/lib/performance/access';

/** Synthetic status for an employee with no goal set at all. */
export const NOT_ASSIGNED = 'NOT_ASSIGNED';

const DAY_MS = 86_400_000;

export async function GET(request: NextRequest) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const cycleId = Number(sp.get('cycleId'));
    if (!Number.isInteger(cycleId) || cycleId <= 0) {
      return NextResponse.json({ error: 'cycleId is required — coverage is always measured against one cycle' }, { status: 400 });
    }

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: scope.companyId },
      select: { id: true, code: true, name: true, startDate: true, endDate: true, goalSettingEnd: true, status: true },
    });
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    const departmentId = sp.get('departmentId');
    const statusFilter = sp.get('status');
    const q = sp.get('q')?.trim();

    // A manager sees their own reporting lines and themselves; HR sees the
    // company. Anyone else gets an empty population rather than a 403 — their
    // coverage is simply nobody, which the page renders honestly.
    let reportingScope: object = {};
    if (!actor.isHr) {
      if (actor.employeeId == null) {
        return NextResponse.json({ error: 'Forbidden — no employee record linked to this login' }, { status: 403 });
      }
      reportingScope = {
        OR: [
          { reportingManagerId: actor.employeeId },
          { secondReportingManagerId: actor.employeeId },
          { id: actor.employeeId },
        ],
      };
    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId: scope.companyId,
        deletedAt: null,
        status: 'active',
        ...reportingScope,
        ...(departmentId
          ? { jobInfos: { some: { effectiveTo: null, departmentId: Number(departmentId) } } }
          : {}),
        ...(q
          ? {
              OR: [
                { oldEmployeeCode: { contains: q } },
                { firstName: { contains: q } },
                { lastName: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        oldEmployeeCode: true,
        firstName: true,
        lastName: true,
        jobInfos: {
          where: { effectiveTo: null },
          take: 1,
          select: {
            joinDate: true,
            designation: { select: { name: true } },
            department: { select: { name: true, id: true } },
          },
        },
        reportingManager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ oldEmployeeCode: 'asc' }],
    });

    // Not eligible for this cycle — joined after it ended.
    const cycleEnd = cycle.endDate;
    const eligible: typeof employees = [];
    let joinedAfterCycle = 0;
    for (const e of employees) {
      const joinDate = e.jobInfos[0]?.joinDate ?? null;
      if (joinDate && joinDate > cycleEnd) {
        joinedAfterCycle += 1;
        continue;
      }
      eligible.push(e);
    }

    const sets = await prisma.employeeGoalSet.findMany({
      where: {
        companyId: scope.companyId,
        cycleId,
        employeeId: { in: eligible.map((e) => e.id) },
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        templateId: true,
        submittedAt: true,
        acceptedAt: true,
        returnedAt: true,
        employeeRemark: true,
        updatedAt: true,
        kras: { select: { id: true, _count: { select: { kpis: true } } } },
      },
    });
    const setByEmployee = new Map(sets.map((s) => [s.employeeId, s]));

    const now = Date.now();

    const all = eligible.map((e) => {
      const set = setByEmployee.get(e.id);
      const job = e.jobInfos[0];
      const status = set?.status ?? NOT_ASSIGNED;

      // How long the set has been sitting with the employee. Only meaningful
      // while it is actually waiting on them.
      const waitingSince = status === 'PENDING_ACCEPTANCE' ? (set?.submittedAt ?? set?.updatedAt ?? null) : null;
      const pendingDays = waitingSince ? Math.floor((now - waitingSince.getTime()) / DAY_MS) : null;

      return {
        employeeId: e.id,
        employeeCode: e.oldEmployeeCode ?? '',
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        designation: job?.designation?.name ?? null,
        department: job?.department?.name ?? null,
        joinDate: job?.joinDate ?? null,
        reportingManager: e.reportingManager
          ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}`.trim()
          : null,
        goalSetId: set?.id ?? null,
        status,
        fromTemplate: set?.templateId != null,
        kraCount: set?.kras.length ?? 0,
        kpiCount: set?.kras.reduce((n, k) => n + k._count.kpis, 0) ?? 0,
        submittedAt: set?.submittedAt ?? null,
        acceptedAt: set?.acceptedAt ?? null,
        returnedAt: set?.returnedAt ?? null,
        employeeRemark: set?.employeeRemark ?? null,
        pendingDays,
      };
    });

    // Summary counts the whole eligible population, so filtering the table by
    // status never changes the denominator the coverage figure is read from.
    const byStatus: Record<string, number> = {
      [NOT_ASSIGNED]: 0, DRAFT: 0, PENDING_ACCEPTANCE: 0, ACCEPTED: 0, RETURNED: 0, COMPLETED: 0,
    };
    for (const r of all) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    const eligibleCount = all.length;
    const withGoals = eligibleCount - byStatus[NOT_ASSIGNED];
    const accepted = byStatus.ACCEPTED + byStatus.COMPLETED;

    const data = statusFilter ? all.filter((r) => r.status === statusFilter) : all;

    return NextResponse.json({
      cycle: {
        id: cycle.id,
        code: cycle.code,
        name: cycle.name,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        goalSettingEnd: cycle.goalSettingEnd,
        status: cycle.status,
      },
      data,
      summary: {
        eligible: eligibleCount,
        withGoals,
        notAssigned: byStatus[NOT_ASSIGNED],
        accepted,
        assignedPct: eligibleCount ? Number(((withGoals / eligibleCount) * 100).toFixed(1)) : 0,
        acceptedPct: eligibleCount ? Number(((accepted / eligibleCount) * 100).toFixed(1)) : 0,
        byStatus,
        joinedAfterCycle,
        shown: data.length,
      },
    });
  } catch (err) {
    console.error('[reports/performance/goal-coverage] GET failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build the coverage report' },
      { status: 500 },
    );
  }
}
