/**
 * GET /api/reports/payroll/ot-other-incentive?year=X&month=Y
 *
 * OT & Other Incentive Report — one row per employee for the selected
 * payroll run: OT hours (from attendance), OT amount, the OT Incentive
 * Bonus (OTIncentiveSlab.flatBonusAmount), and every other personal
 * incentive already computed by payroll: Double Machine, Shift Bonus,
 * Attendance Bonus, Petrol Allowance, Performance Incentive. Supports CSV
 * export via ?format=csv.
 *
 * otAmount, otIncentiveAmount and performanceIncentive are direct
 * PayrollLine columns; Double Machine / Shift Bonus / Attendance Bonus /
 * Petrol Allowance are stored as PayrollLineComponent rows against the
 * DM_INCENTIVE / SHIFT_BONUS / ATT_BONUS / PETROL salary components (see
 * src/lib/payrollCalculation.ts) — summed here per employee the same way.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const COMPONENT_CODES = ['DM_INCENTIVE', 'SHIFT_BONUS', 'ATT_BONUS', 'PETROL'] as const;

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '0');
  const month = parseInt(searchParams.get('month') ?? '0');
  const format = searchParams.get('format');

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const run = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
  });
  if (!run) return NextResponse.json({ error: 'No payroll run for this period' }, { status: 404 });

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: run.id },
    include: {
      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: { where: { effectiveTo: null }, take: 1, select: { department: { select: { name: true } } } },
        },
      },
      components: {
        where: { salaryComponent: { code: { in: [...COMPONENT_CODES] } } },
        select: { amount: true, salaryComponent: { select: { code: true } } },
      },
    },
    orderBy: { employee: { employeeCode: 'asc' } },
  });

  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: { employeeId: { in: lines.map((l) => l.employeeId) }, year, month },
    select: { employeeId: true, otMinutesTotal: true },
  });
  const otMinutesByEmployee = new Map(summaries.map((s) => [s.employeeId, s.otMinutesTotal]));

  const rows = lines.map((l) => {
    const byCode = (code: (typeof COMPONENT_CODES)[number]) =>
      l.components.filter((c) => c.salaryComponent.code === code).reduce((sum, c) => sum + Number(c.amount), 0);

    const otMinutes = otMinutesByEmployee.get(l.employeeId) ?? 0;

    return {
      id: l.id,
      employeeCode: l.employee.employeeCode,
      employeeName: `${l.employee.firstName} ${l.employee.lastName ?? ''}`.trim(),
      department: l.employee.jobInfos[0]?.department?.name ?? '—',
      otHours: Number((otMinutes / 60).toFixed(2)),
      otAmount: Number(l.otAmount),
      otIncentiveAmount: Number(l.otIncentiveAmount),
      doubleMachineIncentive: byCode('DM_INCENTIVE'),
      shiftIncentive: byCode('SHIFT_BONUS'),
      attendanceBonus: byCode('ATT_BONUS'),
      petrolAllowance: byCode('PETROL'),
      performanceIncentive: Number(l.performanceIncentive),
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.otHours += r.otHours;
      acc.otAmount += r.otAmount;
      acc.otIncentiveAmount += r.otIncentiveAmount;
      acc.doubleMachineIncentive += r.doubleMachineIncentive;
      acc.shiftIncentive += r.shiftIncentive;
      acc.attendanceBonus += r.attendanceBonus;
      acc.petrolAllowance += r.petrolAllowance;
      acc.performanceIncentive += r.performanceIncentive;
      return acc;
    },
    { otHours: 0, otAmount: 0, otIncentiveAmount: 0, doubleMachineIncentive: 0, shiftIncentive: 0, attendanceBonus: 0, petrolAllowance: 0, performanceIncentive: 0 }
  );

  if (format === 'csv') {
    const headers = [
      'Employee Code', 'Name', 'Department', 'OT Hours', 'OT Amount', 'OT Incentive Bonus',
      'Double Machine Incentive', 'Shift Incentive', 'Attendance Bonus', 'Petrol Allowance', 'Performance Incentive',
    ];
    const csvRows = rows.map((r) => [
      r.employeeCode, r.employeeName, r.department, r.otHours.toFixed(2), r.otAmount.toFixed(2),
      r.otIncentiveAmount.toFixed(2), r.doubleMachineIncentive.toFixed(2), r.shiftIncentive.toFixed(2),
      r.attendanceBonus.toFixed(2), r.petrolAllowance.toFixed(2), r.performanceIncentive.toFixed(2),
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="ot_other_incentive_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json({ run: { id: run.id, year: run.year, month: run.month, status: run.status }, rows, totals });
}
