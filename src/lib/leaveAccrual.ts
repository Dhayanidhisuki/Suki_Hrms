/**
 * Annual leave credit run — the "Phase 1 has no accrual job" gap called out
 * in src/app/api/workforce/leave/applications/route.ts and .../approve/route.ts
 * finally gets a job. Per client BRD (see project_brd_business_rules memory):
 * leave is credited YEARLY (not monthly), Earned Leave accrues 1 day per 20
 * working days worked (not a flat entitlement), and Casual Leave does NOT
 * carry forward — both now expressed as data on LeaveMaster
 * (accrualType/daysWorkedPerAccrualUnit/carryForwardAllowed/carryForwardMaxDays)
 * rather than hardcoded here, so any future leave type just sets its own rule.
 *
 * Admin-triggered (like Finalize/Freeze/Sync-now elsewhere in this app), not
 * a cron — running it twice for the same year is safe (upsert), so it can be
 * re-run after correcting a leave type's configuration.
 */

import { prisma } from './prisma';

export interface AccrualRunResult {
  year: number;
  employeesProcessed: number;
  leaveTypesProcessed: number;
  balancesWritten: number;
}

/**
 * Sums MonthlyAttendanceSummary.presentDays across every month of `year`
 * for one employee — the "days worked" figure EARNED_PER_DAYS_WORKED divides
 * by. Only counts months that have been finalized/frozen (an OPEN month's
 * present-day count is still provisional and could still change).
 */
async function daysWorkedInYear(employeeId: number, year: number): Promise<number> {
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: { employeeId, year, status: { in: ['FINALIZED', 'FROZEN'] } },
    select: { presentDays: true },
  });
  return summaries.reduce((sum, s) => sum + s.presentDays, 0);
}

export async function runAnnualLeaveCredit(companyId: number, year: number): Promise<AccrualRunResult> {
  const [employees, leaveMasters] = await Promise.all([
    prisma.employee.findMany({ where: { companyId, isActive: true, deletedAt: null }, select: { id: true } }),
    prisma.leaveMaster.findMany({ where: { isActive: true, deletedAt: null } }),
  ]);

  let balancesWritten = 0;

  for (const employee of employees) {
    for (const leaveMaster of leaveMasters) {
      const prior = await prisma.leaveBalance.findUnique({
        where: { employeeId_leaveMasterId_year: { employeeId: employee.id, leaveMasterId: leaveMaster.id, year: year - 1 } },
      });

      let carryForwardIn = 0;
      if (leaveMaster.carryForwardAllowed && prior) {
        const priorClosing = Math.max(0, Number(prior.closingBalance));
        carryForwardIn = leaveMaster.carryForwardMaxDays != null ? Math.min(priorClosing, Number(leaveMaster.carryForwardMaxDays)) : priorClosing;
      }

      const accrued =
        leaveMaster.accrualType === 'EARNED_PER_DAYS_WORKED' && leaveMaster.daysWorkedPerAccrualUnit
          ? Math.floor((await daysWorkedInYear(employee.id, year)) / leaveMaster.daysWorkedPerAccrualUnit)
          : Number(leaveMaster.defaultAnnualDays);

      // Re-running for a year that already has applied/approved leave must not
      // erase that — carry the existing availed/adjusted forward and only
      // recompute the opening/accrued/closing figures around them.
      const existing = await prisma.leaveBalance.findUnique({
        where: { employeeId_leaveMasterId_year: { employeeId: employee.id, leaveMasterId: leaveMaster.id, year } },
      });
      const availed = existing ? Number(existing.availed) : 0;
      const adjusted = existing ? Number(existing.adjusted) : 0;

      const openingBalance = carryForwardIn;
      const closingBalance = openingBalance + accrued - availed + adjusted;

      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveMasterId_year: { employeeId: employee.id, leaveMasterId: leaveMaster.id, year } },
        update: { openingBalance, accrued, carryForwardIn, closingBalance },
        create: { employeeId: employee.id, leaveMasterId: leaveMaster.id, year, openingBalance, accrued, carryForwardIn, closingBalance },
      });
      balancesWritten++;
    }
  }

  return { year, employeesProcessed: employees.length, leaveTypesProcessed: leaveMasters.length, balancesWritten };
}
