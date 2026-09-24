/**
 * GET  /api/payroll/pms?scope=access|config|list&financialYear=...&year=...&month=...
 * POST /api/payroll/pms                              — create/update an employee row
 *
 * Consolidated Performance Incentive API. Supports both the Reporting Manager
 * view (team-only, individual % entry) and the HR/Admin view (config, all
 * employees, override, approve). Company-level config lives in
 * PmsIncentiveConfig; employee rows in PmsIncentive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getPmsAccess,
  getPmsConfig,
  getFinancialYear,
  getDefaultPeriod,
  resolveBasisAmounts,
  resolvePerformanceIncentiveAmounts,
  resolvePresentDays,
  computePmsMoney,
  daysInMonth,
  calculatePmsAmounts,
  canModifyEmployee,
  PMS_STATUSES,
} from '@/lib/pmsIncentive';
import { pmsIncentiveUpsertSchema } from '@/lib/validations/workforce';
import { logActivity } from '@/lib/activity-log';

function employeeSelect() {
  return {
    id: true,
    employeeCode: true,
    oldEmployeeCode: true,
    firstName: true,
    lastName: true,
    reportingManagerId: true,
    reportingManager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
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

export async function GET(request: NextRequest) {
  const access = await getPmsAccess(request);
  if (access instanceof NextResponse) return access;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') ?? 'list';
  const financialYear = searchParams.get('financialYear') ?? getFinancialYear();

  if (scope === 'access') {
    return NextResponse.json({ data: access });
  }

  if (scope === 'config') {
    const [config, salaryComponents] = await Promise.all([
      getPmsConfig(access.companyId, financialYear),
      prisma.salaryComponent.findMany({
        where: { companyId: access.companyId, isActive: true, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return NextResponse.json({ data: { config, salaryComponents, financialYear } });
  }

  if (scope === 'list') {
    const search = searchParams.get('search') ?? '';
    const departmentId = searchParams.get('departmentId');
    const managerId = searchParams.get('managerId');
    const status = searchParams.get('status');
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const config = await getPmsConfig(access.companyId, financialYear);
    const period = yearParam && monthParam
      ? { year: parseInt(yearParam), month: parseInt(monthParam) }
      : config
        ? { year: config.effectiveFrom.getFullYear(), month: config.effectiveFrom.getMonth() + 1 }
        : getDefaultPeriod(financialYear);

    const statusMap: Record<string, string[]> = {
      draft: [PMS_STATUSES.DRAFT],
      process: [PMS_STATUSES.SUBMITTED, PMS_STATUSES.UNDER_REVIEW, PMS_STATUSES.RETURNED, 'pending_hr'],
      hold: [PMS_STATUSES.REJECTED],
      complete: [PMS_STATUSES.APPROVED, PMS_STATUSES.FINALIZED],
    };

    const where: Record<string, unknown> = {
      companyId: access.companyId,
      deletedAt: null,
      isActive: true,
      ...(access.canViewAll
        ? {}
        : { reportingManagerId: access.ownEmployeeId }),
      ...(departmentId ? { jobInfos: { some: { effectiveTo: null, departmentId: parseInt(departmentId) } } } : {}),
      ...(managerId ? { reportingManagerId: parseInt(managerId) } : {}),
    };

    const and: unknown[] = [];
    if (search) {
      and.push({
        OR: [
          { employeeCode: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      });
    }
    // Status filter applies to the PmsIncentive record for this period.
    // Employees with NO record count as 'draft' (synthesized row), so a
    // 'draft' filter must match (no record) OR (record in draft); every
    // other bucket requires a record whose status is in the mapped list.
    if (status) {
      const statusList = statusMap[status] ?? [status];
      if (statusList.includes(PMS_STATUSES.DRAFT)) {
        and.push({
          OR: [
            { pmsIncentives: { none: { year: period.year, month: period.month } } },
            { pmsIncentives: { some: { year: period.year, month: period.month, status: { in: statusList } } } },
          ],
        });
      } else {
        and.push({
          pmsIncentives: { some: { year: period.year, month: period.month, status: { in: statusList } } },
        });
      }
    }
    if (and.length) where.AND = and;

    const [employees, total, departments] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: employeeSelect(),
        orderBy: { firstName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
      prisma.department.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const employeeIds = employees.map((e) => e.id);
    const monthDays = daysInMonth(period.year, period.month);
    const [existing, basisMap, perfMap, presentMap] = await Promise.all([
      prisma.pmsIncentive.findMany({
        where: {
          employeeId: { in: employeeIds },
          year: period.year,
          month: period.month,
          ...(status ? { status: { in: statusMap[status] ?? [status] } } : {}),
        },
        include: {
          config: {
            select: {
              calculationBasis: true,
              salaryComponentId: true,
              targetIncentiveAmount: true,
            },
          },
        },
      }),
      config ? resolveBasisAmounts(employeeIds, config) : new Map<number, number>(),
      resolvePerformanceIncentiveAmounts(employeeIds, access.companyId),
      resolvePresentDays(employeeIds, period.year, period.month),
    ]);

    const recordByEmployee = new Map(existing.map((r) => [r.employeeId, r]));

    const rows = employees.map((emp) => {
      const record = recordByEmployee.get(emp.id);
      const basisAmount = record ? Number(record.basisAmount) : (basisMap.get(emp.id) ?? 0);
      const row = record ?? {
        id: null,
        employeeId: emp.id,
        year: period.year,
        month: period.month,
        financialYear,
        status: PMS_STATUSES.DRAFT,
        companyPercent: 0,
        managerPercent: 0,
        totalPercent: 0,
        basisAmount,
        companyAmount: 0,
        individualAmount: 0,
        overallAmount: 0,
        // Live payout preview for unsaved rows — stored columns are 0 until
        // saved, but the grid recalculates from these inputs.
        performanceIncentive: perfMap.get(emp.id) ?? 0,
        presentDays: presentMap.get(emp.id) ?? 0,
        incentiveMoney: 0,
        incentiveEarn: 0,
        employeeEsi: 0,
        employerEsi: 0,
        pmsNet: 0,
        companyValue: null,
        individualValue: null,
        supportingFileName: null,
        supportingFilePath: null,
        remarks: null,
        rejectionReason: null,
        managerActionByUserId: null,
        hrActionByUserId: null,
        hrActionAt: null,
        calculationBasis: null,
        salaryComponentId: null,
        incentiveType: 'percentage',
        configId: null,
      };

      return {
        recordId: record?.id ?? null,
        employeeId: emp.id,
        // Employee Master's "Employee Code" column is oldEmployeeCode (E125);
        // employeeCode (RC…) is only the internal Reference Code — never
        // substituted in when oldEmployeeCode is blank.
        employeeCode: emp.oldEmployeeCode ?? '',
        employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
        department: emp.jobInfos[0]?.department ?? null,
        designation: emp.jobInfos[0]?.designation ?? null,
        reportingManager: emp.reportingManager,
        year: row.year,
        month: row.month,
        financialYear: row.financialYear ?? financialYear,
        calculationBasis: row.calculationBasis ?? config?.calculationBasis ?? 'basic',
        salaryComponentId: row.salaryComponentId ?? config?.salaryComponentId,
        incentiveType: row.incentiveType ?? config?.incentiveType ?? 'percentage',
        basisAmount,
        companyPercent: Number(row.companyPercent ?? 0),
        individualPercent: Number(row.managerPercent ?? 0),
        totalPercent: Number(row.totalPercent ?? 0),
        companyValue: row.companyValue,
        individualValue: row.individualValue,
        companyAmount: Number(row.companyAmount ?? 0),
        individualAmount: Number(row.individualAmount ?? 0),
        overallAmount: Number(row.overallAmount ?? 0),
        performanceIncentive: record ? Number(record.performanceIncentive) : (perfMap.get(emp.id) ?? 0),
        monthDays,
        presentDays: record ? Number(record.presentDays) : (presentMap.get(emp.id) ?? 0),
        incentiveMoney: Number(row.incentiveMoney ?? 0),
        incentiveEarn: Number(row.incentiveEarn ?? 0),
        employeeEsi: Number(row.employeeEsi ?? 0),
        employerEsi: Number(row.employerEsi ?? 0),
        pmsNet: Number(row.pmsNet ?? 0),
        status: row.status,
        supportingFileName: row.supportingFileName,
        supportingFilePath: row.supportingFilePath,
        remarks: row.remarks,
        rejectionReason: row.rejectionReason,
        submittedByUserId: row.managerActionByUserId,
        approvedByUserId: row.hrActionByUserId,
        approvedDate: row.hrActionAt,
      };
    });

    return NextResponse.json({
      data: {
        rows,
        config,
        period,
        financialYear,
        departments,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  }

  return NextResponse.json({ error: 'Unknown scope' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const access = await getPmsAccess(request);
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const parsed = pmsIncentiveUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { employeeId, financialYear } = parsed.data;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: access.companyId, deletedAt: null },
    select: { ...employeeSelect() },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const isManager = await canModifyEmployee(access.ownEmployeeId, employeeId, employee);
  const isAdmin = access.canApprove;

  if (!isManager && !isAdmin) {
    return NextResponse.json({ error: 'You do not have permission to access this employee\'s incentive details.' }, { status: 403 });
  }

  const config = await getPmsConfig(access.companyId, financialYear);
  if (!config) {
    return NextResponse.json({ error: 'No active Performance Incentive configuration for this financial year.' }, { status: 409 });
  }

  const period = parsed.data.year && parsed.data.month
    ? { year: parsed.data.year, month: parsed.data.month }
    : { year: config.effectiveFrom.getFullYear(), month: config.effectiveFrom.getMonth() + 1 };
  const existing = await prisma.pmsIncentive.findUnique({
    where: { employeeId_year_month: { employeeId, year: period.year, month: period.month } },
  });

  if (existing && existing.status !== PMS_STATUSES.DRAFT && existing.status !== PMS_STATUSES.RETURNED) {
    return NextResponse.json({ error: `This record is already ${existing.status} and cannot be saved as a draft.` }, { status: 409 });
  }

  const basisMap = await resolveBasisAmounts([employeeId], config);
  const basisAmount = basisMap.get(employeeId) ?? 0;

  // Field ownership: Company % / value is HR-only — a manager's save keeps
  // the record's existing value (or the config default for new rows).
  const calc = calculatePmsAmounts(basisAmount, config, {
    companyPercent: isAdmin ? parsed.data.companyPercent : existing?.companyPercent,
    companyValue: isAdmin ? parsed.data.companyValue : existing?.companyValue,
    managerPercent: parsed.data.individualPercent ?? existing?.managerPercent,
    individualValue: parsed.data.individualValue ?? existing?.individualValue,
  });

  if (config.incentiveType === 'percentage') {
    if (calc.companyPercent > 50) {
      return NextResponse.json({ error: 'Company Incentive cannot exceed 50%.' }, { status: 400 });
    }
    if (calc.managerPercent > 50) {
      return NextResponse.json({ error: 'Individual Incentive cannot exceed 50%.' }, { status: 400 });
    }
    if (calc.totalPercent > 100) {
      return NextResponse.json({ error: 'Overall Performance Incentive cannot exceed 100%.' }, { status: 400 });
    }
  }

  // Any filled % / value moves the row into the Process bucket (submitted) —
  // a row is only kept as draft when every figure is still 0.
  const hasValue =
    calc.companyPercent > 0 || calc.managerPercent > 0 || calc.companyValue > 0 || calc.individualValue > 0;
  const newStatus = parsed.data.submit || hasValue ? PMS_STATUSES.SUBMITTED : PMS_STATUSES.DRAFT;

  // Attendance-prorated payout — the fixed "Performance Incentive" salary
  // component is the base, scaled by present days and the combined PMS %.
  const monthDays = daysInMonth(period.year, period.month);
  const [perfMap, presentMap] = await Promise.all([
    resolvePerformanceIncentiveAmounts([employeeId], access.companyId),
    resolvePresentDays([employeeId], period.year, period.month),
  ]);
  const money = computePmsMoney(perfMap.get(employeeId) ?? 0, monthDays, presentMap.get(employeeId) ?? 0, calc.totalPercent);

  const record = await prisma.$transaction(async (tx) => {
    const upserted = await tx.pmsIncentive.upsert({
      where: { employeeId_year_month: { employeeId, year: period.year, month: period.month } },
      create: {
        employeeId,
        year: period.year,
        month: period.month,
        configId: config.id,
        financialYear,
        calculationBasis: config.calculationBasis,
        salaryComponentId: config.salaryComponentId,
        incentiveType: config.incentiveType,
        basisAmount,
        companyPercent: calc.companyPercent,
        managerPercent: calc.managerPercent,
        totalPercent: calc.totalPercent,
        companyValue: calc.companyValue,
        individualValue: calc.individualValue,
        companyAmount: calc.companyAmount,
        individualAmount: calc.individualAmount,
        overallAmount: calc.overallAmount,
        ...money,
        status: newStatus,
        remarks: parsed.data.remarks ?? null,
        managerActionByUserId: parsed.data.submit ? access.userId : null,
        managerActionAt: parsed.data.submit ? new Date() : null,
      },
      update: {
        configId: config.id,
        financialYear,
        calculationBasis: config.calculationBasis,
        salaryComponentId: config.salaryComponentId,
        incentiveType: config.incentiveType,
        basisAmount,
        companyPercent: calc.companyPercent,
        managerPercent: calc.managerPercent,
        totalPercent: calc.totalPercent,
        companyValue: calc.companyValue,
        individualValue: calc.individualValue,
        companyAmount: calc.companyAmount,
        individualAmount: calc.individualAmount,
        overallAmount: calc.overallAmount,
        ...money,
        status: newStatus,
        remarks: parsed.data.remarks ?? null,
        managerActionByUserId: parsed.data.submit ? access.userId : existing?.managerActionByUserId,
        managerActionAt: parsed.data.submit ? new Date() : existing?.managerActionAt,
      },
    });

    const oldValue = existing ? { managerPercent: Number(existing.managerPercent), status: existing.status } : null;
    const newValue = { managerPercent: calc.managerPercent, status: newStatus };
    await logActivity(tx, {
      employeeId,
      activityType: 'pms_saved',
      module: 'pms',
      performedByUserId: access.userId,
      oldValue,
      newValue,
      remarks: parsed.data.remarks ?? undefined,
      relatedRecordId: upserted.id,
    });

    return upserted;
  });

  return NextResponse.json(record, { status: existing ? 200 : 201 });
}

/** DELETE /api/payroll/pms — body: { ids: number[] }
 *  HR/Admin may delete any company record; Reporting Managers may only
 *  delete their own team's draft/returned rows. */
export async function DELETE(request: NextRequest) {
  const access = await getPmsAccess(request);
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids are required' }, { status: 400 });
  }

  const records = await prisma.pmsIncentive.findMany({
    where: { id: { in: ids }, employee: { companyId: access.companyId } },
    include: { employee: { select: { id: true, companyId: true, reportingManagerId: true, deletedAt: true } } },
  });
  if (records.length === 0) {
    return NextResponse.json({ error: 'No matching records found' }, { status: 404 });
  }

  if (!access.canApprove) {
    for (const rec of records) {
      const allowed =
        (await canModifyEmployee(access.ownEmployeeId, rec.employeeId, rec.employee)) &&
        [PMS_STATUSES.DRAFT, PMS_STATUSES.RETURNED].includes(rec.status as never);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Only draft or returned team records can be deleted.' },
          { status: 403 }
        );
      }
    }
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.pmsIncentive.deleteMany({ where: { id: { in: records.map((r) => r.id) } } });
    for (const rec of records) {
      await logActivity(tx, {
        employeeId: rec.employeeId,
        activityType: 'pms_deleted',
        module: 'pms',
        performedByUserId: access.userId,
        oldValue: { status: rec.status },
        relatedRecordId: rec.id,
      });
    }
    return records.length;
  });

  return NextResponse.json({ data: { deleted } });
}
