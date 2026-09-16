/**
 * GET /api/reports/payroll/double-machine?year=X&month=Y&format=csv&detail=1
 *
 * Complete Double Machine Report — source + computed data side-by-side.
 *
 * For each employee:
 *   - Monthly summary: DoubleMachineEntry per-day entries (source) summed
 *     vs the DM_INCENTIVE PayrollLineComponent amount (computed), plus the
 *     legacy DoubleMachineIncentive manual HR entry if one exists.
 *   - Per-day detail (in `dailyBreakdown`): each DoubleMachineEntry row
 *     with date, machine1, machine2, numMachines, workingHours,
 *     incentiveRate, calculatedIncentive, status, approvedBy.
 *
 * The `?detail=1` query param returns per-day rows for all employees
 * (flat list) instead of nested under each employee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '0');
  const month = parseInt(searchParams.get('month') ?? '0');
  const format = searchParams.get('format');
  const detail = searchParams.get('detail') === '1';

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // ── Fetch the payroll run (computed side) ──
  const run = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
  });

  // ── Fetch all active employees ──
  const employees = await prisma.employee.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  // ── Fetch DoubleMachineEntry rows (source: per-day entries) ──
  const dmEntries = await prisma.doubleMachineEntry.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
    },
    orderBy: { date: 'asc' },
  });

  // Group by employee
  const dmByEmp = new Map<number, typeof dmEntries>();
  for (const d of dmEntries) {
    const list = dmByEmp.get(d.employeeId) ?? [];
    list.push(d);
    dmByEmp.set(d.employeeId, list);
  }

  // ── Fetch DoubleMachineIncentive rows (source: legacy manual HR entry) ──
  const dmIncentives = await prisma.doubleMachineIncentive.findMany({
    where: {
      companyId: scope.companyId,
      year,
      month,
    },
  });
  const dmIncentiveByEmp = new Map(dmIncentives.map((d) => [d.employeeId, d]));

  // ── Fetch payroll line components for DM_INCENTIVE (computed side) ──
  let computedDmByEmp = new Map<number, { amount: number; isAdhoc: boolean }>();
  if (run) {
    const dmComponent = await prisma.salaryComponent.findUnique({
      where: { companyId_code: { companyId: scope.companyId, code: 'DM_INCENTIVE' } },
    });
    if (dmComponent) {
      const dmComps = await prisma.payrollLineComponent.findMany({
        where: {
          salaryComponentId: dmComponent.id,
          payrollLine: { payrollRunId: run.id },
        },
        include: { payrollLine: { select: { employeeId: true } } },
      });
      computedDmByEmp = new Map(dmComps.map((c) => [
        c.payrollLine.employeeId,
        { amount: Number(c.amount), isAdhoc: c.isAdhoc },
      ]));
    }
  }

  // ── Build per-employee rows ──
  const rows = employees.map((emp) => {
    const jobInfo = emp.jobInfos[0];
    const entries = dmByEmp.get(emp.id) ?? [];
    const legacyIncentive = dmIncentiveByEmp.get(emp.id);
    const computed = computedDmByEmp.get(emp.id);

    // Source: sum from per-day entries
    const approvedEntries = entries.filter((e) => e.status === 'APPROVED');
    const totalCalculatedIncentive = entries.reduce((sum, e) => sum + Number(e.calculatedIncentive), 0);
    const totalApprovedIncentive = approvedEntries.reduce((sum, e) => sum + Number(e.calculatedIncentive), 0);
    const totalWorkingHours = entries.reduce((sum, e) => sum + Number(e.workingHours), 0);
    const totalApprovedWorkingHours = approvedEntries.reduce((sum, e) => sum + Number(e.workingHours), 0);

    // Per-day detail
    const dailyBreakdown = entries.map((d) => ({
      id: d.id,
      date: d.date.toISOString().slice(0, 10),
      machine1: d.machine1 ?? '—',
      machine2: d.machine2 ?? '—',
      numMachines: d.numMachines,
      workingHours: Number(d.workingHours),
      incentiveRate: Number(d.incentiveRate),
      calculatedIncentive: Number(d.calculatedIncentive),
      status: d.status,
      hrRemarks: d.hrRemarks,
      approvedAt: d.approvedAt ? d.approvedAt.toISOString() : null,
    }));

    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
      department: jobInfo?.department?.name ?? '—',
      designation: jobInfo?.designation?.name ?? '—',
      // Source: per-day entries
      totalEntries: entries.length,
      approvedEntries: approvedEntries.length,
      pendingEntries: entries.filter((e) => e.status === 'PENDING').length,
      rejectedEntries: entries.filter((e) => e.status === 'REJECTED').length,
      totalWorkingHours,
      totalApprovedWorkingHours,
      totalCalculatedIncentive,
      totalApprovedIncentive,
      // Source: legacy manual HR entry
      legacyDoubleMachine: legacyIncentive ? Number(legacyIncentive.doubleMachine) : 0,
      legacyAttendanceBonus: legacyIncentive ? Number(legacyIncentive.attendanceBonus) : 0,
      legacyShiftIncentive: legacyIncentive ? Number(legacyIncentive.shiftIncentive) : 0,
      legacyOtWeeklyInc: legacyIncentive ? Number(legacyIncentive.otWeeklyInc) : 0,
      legacyEmployeeR: legacyIncentive ? Number(legacyIncentive.employeeR) : 0,
      legacyStatus: legacyIncentive?.status ?? '—',
      // Computed: payroll line component
      computedDmIncentive: computed?.amount ?? 0,
      computedIsAdhoc: computed?.isAdhoc ?? false,
      // Reconciliation: source approved vs computed paid
      sourceVsComputedDiff: Math.abs(totalApprovedIncentive - (computed?.amount ?? 0)),
      sourceVsComputedMatch: Math.abs(totalApprovedIncentive - (computed?.amount ?? 0)) <= 1,
      // Per-day detail
      dailyBreakdown,
    };
  });

  // Filter to only employees with entries or computed amounts
  const rowsWithData = rows.filter((r) => r.totalEntries > 0 || r.computedDmIncentive > 0 || r.legacyDoubleMachine > 0);

  // ── Totals ──
  const totals = rowsWithData.reduce(
    (acc, r) => {
      acc.totalEntries += r.totalEntries;
      acc.approvedEntries += r.approvedEntries;
      acc.totalWorkingHours += r.totalWorkingHours;
      acc.totalApprovedWorkingHours += r.totalApprovedWorkingHours;
      acc.totalCalculatedIncentive += r.totalCalculatedIncentive;
      acc.totalApprovedIncentive += r.totalApprovedIncentive;
      acc.computedDmIncentive += r.computedDmIncentive;
      acc.legacyDoubleMachine += r.legacyDoubleMachine;
      return acc;
    },
    {
      totalEntries: 0, approvedEntries: 0, totalWorkingHours: 0,
      totalApprovedWorkingHours: 0, totalCalculatedIncentive: 0,
      totalApprovedIncentive: 0, computedDmIncentive: 0, legacyDoubleMachine: 0,
    }
  );

  // ── CSV export ──
  if (format === 'csv') {
    if (detail) {
      // Per-day detail CSV
      const headers = [
        'Employee Code', 'Employee Name', 'Department', 'Date',
        'Machine 1', 'Machine 2', 'Num Machines', 'Working Hours',
        'Incentive Rate', 'Calculated Incentive', 'Status', 'HR Remarks',
      ];
      const csvRows: string[] = [];
      for (const r of rowsWithData) {
        for (const d of r.dailyBreakdown) {
          csvRows.push([
            r.employeeCode, r.employeeName, r.department, d.date,
            d.machine1, d.machine2, d.numMachines, d.workingHours.toFixed(2),
            d.incentiveRate.toFixed(2), d.calculatedIncentive.toFixed(2),
            d.status, d.hrRemarks ?? '',
          ].map((v) => `"${v}"`).join(','));
        }
      }
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="double_machine_detail_${year}_${month}.csv"` },
      });
    }

    // Monthly summary CSV
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Designation',
      'Total Entries', 'Approved', 'Pending', 'Rejected',
      'Total Working Hours', 'Approved Working Hours',
      'Total Calculated Incentive', 'Total Approved Incentive',
      'Legacy Double Machine', 'Legacy Att. Bonus', 'Legacy Shift Incentive',
      'Legacy OT Weekly Inc', 'Legacy Employee R', 'Legacy Status',
      'Computed DM Incentive (Payroll)', 'Source-Computed Diff', 'Match',
    ];
    const csvRows = rowsWithData.map((r) => [
      r.employeeCode, r.employeeName, r.department, r.designation,
      r.totalEntries, r.approvedEntries, r.pendingEntries, r.rejectedEntries,
      r.totalWorkingHours.toFixed(2), r.totalApprovedWorkingHours.toFixed(2),
      r.totalCalculatedIncentive.toFixed(2), r.totalApprovedIncentive.toFixed(2),
      r.legacyDoubleMachine.toFixed(2), r.legacyAttendanceBonus.toFixed(2), r.legacyShiftIncentive.toFixed(2),
      r.legacyOtWeeklyInc.toFixed(2), r.legacyEmployeeR.toFixed(2), r.legacyStatus,
      r.computedDmIncentive.toFixed(2), r.sourceVsComputedDiff.toFixed(2), r.sourceVsComputedMatch ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="double_machine_summary_${year}_${month}.csv"` },
    });
  }

  // ── JSON response ──
  if (detail) {
    const flatDaily: Array<{
      employeeCode: string;
      employeeName: string;
      department: string;
      date: string;
      machine1: string;
      machine2: string;
      numMachines: number;
      workingHours: number;
      incentiveRate: number;
      calculatedIncentive: number;
      status: string;
      hrRemarks: string | null;
    }> = [];
    for (const r of rowsWithData) {
      for (const d of r.dailyBreakdown) {
        flatDaily.push({
          employeeCode: r.employeeCode,
          employeeName: r.employeeName,
          department: r.department,
          date: d.date,
          machine1: d.machine1,
          machine2: d.machine2,
          numMachines: d.numMachines,
          workingHours: d.workingHours,
          incentiveRate: d.incentiveRate,
          calculatedIncentive: d.calculatedIncentive,
          status: d.status,
          hrRemarks: d.hrRemarks,
        });
      }
    }
    return NextResponse.json({
      run: run ? { id: run.id, year: run.year, month: run.month, status: run.status } : null,
      rows: flatDaily,
      totals,
    });
  }

  return NextResponse.json({
    run: run ? { id: run.id, year: run.year, month: run.month, status: run.status } : null,
    rows: rowsWithData,
    totals,
  });
}
