/**
 * GET  /api/payroll/double-machine?year=&month=&departmentId=&status=&search=
 * POST /api/payroll/double-machine — upsert one employee-month row
 *
 * Employee identity (code, name, department, designation) is always read
 * from Employee + current JobInfo. Amounts live on DoubleMachineIncentive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { doubleMachineUpsertSchema } from '@/lib/validations/payroll';
import { logActivity } from '@/lib/activity-log';
import { checkPeriodEditable } from '@/lib/payrollGuard';

const STATUS_FILTER: Record<string, string[]> = {
  draft: ['draft'],
  process: ['process'],
  hold: ['hold'],
  complete: ['complete'],
};

function employeeSelect() {
  return {
    id: true,
    employeeCode: true,
    oldEmployeeCode: true,
    firstName: true,
    lastName: true,
    jobInfos: {
      where: { effectiveTo: null },
      take: 1,
      select: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
      },
    },
  } as const;
}

function displayCode(emp: { employeeCode: string; oldEmployeeCode: string | null }) {
  return emp.oldEmployeeCode?.trim() || '';
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '', 10);
  const month = parseInt(searchParams.get('month') ?? '', 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  // Paged. This used to return every active employee in the company in one
  // response — fine for a 10-person test database, not for the 438 in
  // production, and the grid rendered all of them.
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));

  const search = (searchParams.get('search') ?? '').trim();
  const departmentId = searchParams.get('departmentId');
  const status = searchParams.get('status') ?? '';

  const where: Record<string, unknown> = {
    companyId: scope.companyId,
    deletedAt: null,
    isActive: true,
  };

  const and: unknown[] = [];
  if (departmentId) {
    and.push({ jobInfos: { some: { effectiveTo: null, departmentId: parseInt(departmentId, 10) } } });
  }
  if (search) {
    and.push({
      OR: [
        { oldEmployeeCode: { contains: search } },
        { employeeCode: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    });
  }
  if (status) {
    const statusList = STATUS_FILTER[status] ?? [status];
    if (statusList.includes('draft')) {
      and.push({
        OR: [
          { doubleMachineIncentives: { none: { year, month } } },
          { doubleMachineIncentives: { some: { year, month, status: { in: statusList } } } },
        ],
      });
    } else {
      and.push({
        doubleMachineIncentives: { some: { year, month, status: { in: statusList } } },
      });
    }
  }
  if (and.length) where.AND = and;

  const [employees, total, departments, allMatchingIds] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: employeeSelect(),
      orderBy: [{ firstName: 'asc' }, { employeeCode: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employee.count({ where }),
    prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Ids for the whole filtered set, so the footer totals cover everything
    // the filters match rather than just the visible page — a page-only total
    // is worse than none, because it looks like a total.
    prisma.employee.findMany({ where, select: { id: true } }),
  ]);

  const records = await prisma.doubleMachineIncentive.findMany({
    where: {
      companyId: scope.companyId,
      year,
      month,
      employeeId: { in: employees.map((e) => e.id) },
    },
  });
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

  // Resolve the approver/editor names in one query. The model has recorded
  // these user ids all along but the response never returned them, so the grid
  // could not show who touched a row — which matters now that `complete` is
  // paid by payroll.
  const userIds = [...new Set(records.flatMap((r) => [r.approvedByUserId, r.updatedByUserId]).filter((n): n is number => !!n))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u.email]));

  // Whether this period is still open — the UI disables its write controls
  // rather than letting the user discover the 409 by pressing a button.
  const periodRun = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
    select: { status: true },
  });
  const periodLocked = periodRun?.status === 'APPROVED' || periodRun?.status === 'LOCKED';

  // Which employees actually have a payroll line for this period. An entry for
  // someone with no line reaches no payslip, and the grid should say so rather
  // than showing amounts that quietly go nowhere.
  const linedEmployeeIds = periodRun
    ? new Set((await prisma.payrollLine.findMany({
        where: { payrollRun: { companyId: scope.companyId, year, month } },
        select: { employeeId: true },
      })).map((l) => l.employeeId))
    : new Set<number>();

  const rows = employees.map((emp) => {
    const rec = byEmployee.get(emp.id);
    return {
      recordId: rec?.id ?? null,
      employeeId: emp.id,
      employeeCode: displayCode(emp),
      oldEmployeeCode: emp.oldEmployeeCode,
      referenceCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      department: emp.jobInfos[0]?.department ?? null,
      designation: emp.jobInfos[0]?.designation ?? null,
      year,
      month,
      doubleMachine: Number(rec?.doubleMachine ?? 0),
      attendanceBonus: Number(rec?.attendanceBonus ?? 0),
      shiftIncentive: Number(rec?.shiftIncentive ?? 0),
      otWeeklyInc: Number(rec?.otWeeklyInc ?? 0),
      employeeR: Number(rec?.employeeR ?? 0),
      status: rec?.status ?? 'draft',
      remarks: rec?.remarks ?? null,
      hasPayrollLine: linedEmployeeIds.has(emp.id),
      approvedBy: rec?.approvedByUserId ? userById.get(rec.approvedByUserId) ?? null : null,
      approvedAt: rec?.approvedAt ? rec.approvedAt.toISOString() : null,
      updatedBy: rec?.updatedByUserId ? userById.get(rec.updatedByUserId) ?? null : null,
      updatedAt: rec?.updatedAt ? rec.updatedAt.toISOString() : null,
      rejectionReason: rec?.rejectionReason ?? null,
    };
  });

  const totalsAgg = await prisma.doubleMachineIncentive.aggregate({
    where: {
      companyId: scope.companyId, year, month,
      employeeId: { in: allMatchingIds.map((e) => e.id) },
    },
    _sum: { doubleMachine: true, attendanceBonus: true, shiftIncentive: true, otWeeklyInc: true, employeeR: true },
    _count: { _all: true },
  });
  const totals = {
    doubleMachine: Number(totalsAgg._sum.doubleMachine ?? 0),
    attendanceBonus: Number(totalsAgg._sum.attendanceBonus ?? 0),
    shiftIncentive: Number(totalsAgg._sum.shiftIncentive ?? 0),
    otWeeklyInc: Number(totalsAgg._sum.otWeeklyInc ?? 0),
    employeeR: Number(totalsAgg._sum.employeeR ?? 0),
    // Count of actual incentive rows, not of employees — the grid lists only
    // employees who have a row, so totalling "employees" would caption a
    // 0-row grid with the full headcount.
    recordCount: totalsAgg._count._all,
  };

  // Counts for the whole company/period so the summary bar reflects what is
  // left to action before payroll runs, not just the current page. `draft` is
  // the virtual state for an employee with no row at all, so it is the
  // headcount minus everyone who has one.
  const statusGroups = await prisma.doubleMachineIncentive.groupBy({
    by: ['status'],
    where: { companyId: scope.companyId, year, month },
    _count: { _all: true },
  });
  const activeHeadcount = await prisma.employee.count({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
  });
  const withRow = statusGroups.reduce((n, g) => n + g._count._all, 0);
  const statusCounts: Record<string, number> = {
    draft: Math.max(0, activeHeadcount - withRow),
    process: 0, hold: 0, complete: 0,
  };
  for (const g of statusGroups) statusCounts[g.status] = (statusCounts[g.status] ?? 0) + g._count._all;

  return NextResponse.json({
    data: {
      rows, departments, year, month, periodLocked, statusCounts,
      periodRunStatus: periodRun?.status ?? null,
      totals,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = doubleMachineUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Nothing may change behind an approved/locked payroll run — the payslips
  // for that period are already out.
  const lockErr = await checkPeriodEditable(scope.companyId, parsed.data.year, parsed.data.month);
  if (lockErr) return lockErr;

  const userId = Number(request.headers.get('x-user-id')) || null;
  // Defaults to `process`, never `complete`. `complete` is what payroll pays,
  // so it is reachable only through the transition route, which requires
  // payroll.dm.approve and records who signed it off.
  const status = parsed.data.status ?? 'process';
  const amounts = {
    doubleMachine: parsed.data.doubleMachine,
    attendanceBonus: parsed.data.attendanceBonus,
    shiftIncentive: parsed.data.shiftIncentive,
    otWeeklyInc: parsed.data.otWeeklyInc,
    employeeR: parsed.data.employeeR,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.doubleMachineIncentive.findUnique({
      where: {
        employeeId_year_month: {
          employeeId: parsed.data.employeeId,
          year: parsed.data.year,
          month: parsed.data.month,
        },
      },
    });

    const row = existing
      ? await tx.doubleMachineIncentive.update({
          where: { id: existing.id },
          data: {
            ...amounts,
            status,
            remarks: parsed.data.remarks ?? existing.remarks,
            updatedByUserId: userId,
          },
        })
      : await tx.doubleMachineIncentive.create({
          data: {
            companyId: scope.companyId,
            employeeId: parsed.data.employeeId,
            year: parsed.data.year,
            month: parsed.data.month,
            ...amounts,
            status,
            remarks: parsed.data.remarks ?? null,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });

    await logActivity(tx, {
      employeeId: parsed.data.employeeId,
      activityType: existing ? 'double_machine_updated' : 'double_machine_created',
      module: 'double-machine',
      performedByUserId: userId,
      oldValue: existing ? { status: existing.status } : undefined,
      newValue: { status: row.status, ...amounts },
      relatedRecordId: row.id,
    });
    return row;
  });

  return NextResponse.json({ data: saved });
}

/** DELETE /api/payroll/double-machine — body: { ids: number[] } */
export async function DELETE(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids are required' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;

  // Refuse if any of the targeted rows sits in a locked period.
  const targets = await prisma.doubleMachineIncentive.findMany({
    where: { id: { in: ids }, companyId: scope.companyId },
    select: { year: true, month: true },
  });
  for (const period of new Set(targets.map((t) => `${t.year}-${t.month}`))) {
    const [y, m] = period.split('-').map(Number);
    const lockErr = await checkPeriodEditable(scope.companyId, y, m);
    if (lockErr) return lockErr;
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const rows = await tx.doubleMachineIncentive.findMany({
      where: { id: { in: ids }, companyId: scope.companyId },
      select: { id: true, employeeId: true },
    });
    if (rows.length === 0) return 0;
    await tx.doubleMachineIncentive.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    for (const r of rows) {
      await logActivity(tx, {
        employeeId: r.employeeId,
        activityType: 'double_machine_deleted',
        module: 'double-machine',
        performedByUserId: userId,
        relatedRecordId: r.id,
      });
    }
    return rows.length;
  });

  return NextResponse.json({ data: { deleted } });
}
