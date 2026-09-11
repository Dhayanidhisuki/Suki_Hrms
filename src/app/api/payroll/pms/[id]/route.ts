/**
 * PUT /api/payroll/pms/[id] — update an employee-level Performance Incentive
 * row. Reporting Managers may update their own team's draft/returned rows;
 * HR/Admin may update any row (audited override).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getPmsAccess,
  getPmsConfig,
  resolveBasisAmounts,
  resolvePerformanceIncentiveAmounts,
  resolvePresentDays,
  computePmsMoney,
  daysInMonth,
  calculatePmsAmounts,
  toNum,
  canModifyEmployee,
  PMS_STATUSES,
} from '@/lib/pmsIncentive';
import { pmsIncentiveUpdateSchema } from '@/lib/validations/workforce';
import { logActivity } from '@/lib/activity-log';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getPmsAccess(request);
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const record = await prisma.pmsIncentive.findUnique({
    where: { id: Number(id) },
    include: { employee: { select: { id: true, companyId: true, reportingManagerId: true, deletedAt: true } } },
  });
  if (!record || record.employee.companyId !== access.companyId) {
    return NextResponse.json({ error: 'PMS incentive submission not found' }, { status: 404 });
  }

  const isManager = await canModifyEmployee(access.ownEmployeeId, record.employeeId, record.employee);
  const isAdmin = access.canApprove;

  if (!isManager && !isAdmin) {
    return NextResponse.json({ error: 'You do not have permission to access this employee\'s incentive details.' }, { status: 403 });
  }
  if (isManager && !isAdmin && ![PMS_STATUSES.DRAFT, PMS_STATUSES.RETURNED].includes(record.status as never)) {
    return NextResponse.json({ error: `This record is already ${record.status} and can no longer be edited.` }, { status: 409 });
  }

  const parsed = pmsIncentiveUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Period may be moved by the edit — guard the employee/year/month unique key.
  const newYear = parsed.data.year ?? record.year;
  const newMonth = parsed.data.month ?? record.month;
  const newFinancialYear = parsed.data.financialYear ?? record.financialYear;
  if (newYear !== record.year || newMonth !== record.month) {
    const dup = await prisma.pmsIncentive.findUnique({
      where: { employeeId_year_month: { employeeId: record.employeeId, year: newYear, month: newMonth } },
      select: { id: true },
    });
    if (dup && dup.id !== record.id) {
      return NextResponse.json({ error: 'A record already exists for this employee in the selected year/month.' }, { status: 409 });
    }
  }

  const config = await getPmsConfig(access.companyId, newFinancialYear ?? undefined);
  const basis = config?.calculationBasis ?? record.calculationBasis ?? 'basic';
  const salaryComponentId = config?.salaryComponentId ?? record.salaryComponentId;
  const basisMap = await resolveBasisAmounts(
    [record.employeeId],
    config ?? {
      calculationBasis: basis,
      salaryComponentId,
      targetIncentiveAmount: null,
    }
  );
  const basisAmount = basisMap.get(record.employeeId) ?? toNum(record.basisAmount);

  const calc = calculatePmsAmounts(
    basisAmount,
    config ?? {
      incentiveType: record.incentiveType,
      companyPercent: record.companyPercent,
      companyValue: record.companyValue,
    },
    {
      companyPercent: isAdmin ? parsed.data.companyPercent ?? record.companyPercent : record.companyPercent,
      managerPercent: parsed.data.individualPercent ?? record.managerPercent,
      companyValue: isAdmin ? parsed.data.companyValue ?? record.companyValue : record.companyValue,
      individualValue: parsed.data.individualValue ?? record.individualValue,
    }
  );

  const incentiveType = config?.incentiveType ?? record.incentiveType ?? 'percentage';
  if (incentiveType === 'percentage') {
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

  // Same rule as POST: filling any % / value on a draft/returned row moves it
  // into the Process bucket; an HR edit on an already-submitted row moves it
  // to under_review instead.
  const hasValue =
    calc.companyPercent > 0 || calc.managerPercent > 0 || calc.companyValue > 0 || calc.individualValue > 0;
  const newStatus =
    parsed.data.submit || (hasValue && [PMS_STATUSES.DRAFT, PMS_STATUSES.RETURNED].includes(record.status as never))
      ? PMS_STATUSES.SUBMITTED
      : isAdmin && [PMS_STATUSES.SUBMITTED, 'pending_hr', PMS_STATUSES.APPROVED, PMS_STATUSES.REJECTED].includes(record.status as never)
        ? PMS_STATUSES.UNDER_REVIEW
        : record.status;

  const monthDays = daysInMonth(newYear, newMonth);
  const [perfMap, presentMap] = await Promise.all([
    resolvePerformanceIncentiveAmounts([record.employeeId], access.companyId),
    resolvePresentDays([record.employeeId], newYear, newMonth),
  ]);
  const money = computePmsMoney(perfMap.get(record.employeeId) ?? 0, monthDays, presentMap.get(record.employeeId) ?? 0, calc.totalPercent);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.pmsIncentive.update({
      where: { id: record.id },
      data: {
        year: newYear,
        month: newMonth,
        financialYear: newFinancialYear,
        calculationBasis: basis,
        salaryComponentId,
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
        remarks: parsed.data.remarks ?? record.remarks,
        status: newStatus,
        managerActionByUserId: parsed.data.submit ? access.userId : record.managerActionByUserId,
        managerActionAt: parsed.data.submit ? new Date() : record.managerActionAt,
        hrActionByUserId: isAdmin ? access.userId : record.hrActionByUserId,
        hrActionAt: isAdmin && parsed.data.reason ? new Date() : record.hrActionAt,
      },
    });

    await logActivity(tx, {
      employeeId: record.employeeId,
      activityType: isAdmin ? 'pms_hr_override' : 'pms_saved',
      module: 'pms',
      performedByUserId: access.userId,
      oldValue: {
        companyPercent: Number(record.companyPercent),
        managerPercent: Number(record.managerPercent),
        totalPercent: Number(record.totalPercent),
        companyAmount: Number(record.companyAmount),
        individualAmount: Number(record.individualAmount),
        overallAmount: Number(record.overallAmount),
        status: record.status,
      },
      newValue: {
        companyPercent: calc.companyPercent,
        managerPercent: calc.managerPercent,
        totalPercent: calc.totalPercent,
        companyAmount: calc.companyAmount,
        individualAmount: calc.individualAmount,
        overallAmount: calc.overallAmount,
        status: newStatus,
      },
      remarks: parsed.data.reason ?? parsed.data.remarks ?? undefined,
      relatedRecordId: record.id,
    });

    return saved;
  });

  return NextResponse.json(updated);
}
