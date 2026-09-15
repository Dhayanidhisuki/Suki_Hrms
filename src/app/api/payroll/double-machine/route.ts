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
  return emp.oldEmployeeCode?.trim() || emp.employeeCode;
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

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: employeeSelect(),
      orderBy: [{ firstName: 'asc' }, { employeeCode: 'asc' }],
    }),
    prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
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
    };
  });

  return NextResponse.json({ data: { rows, departments, year, month } });
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

  const userId = Number(request.headers.get('x-user-id')) || null;
  const status = parsed.data.status ?? 'complete';
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
