/**
 * The company's monthly permission (short-leave) allowance.
 *
 * The pool is set per company and spent in whatever splits the employee
 * chooses — 30 minutes one day, an hour the next — so four different call
 * sites need the same number: the ESS balance, the approval check that sets
 * exceedsAllowance, and the payroll pass that converts the excess to LOP.
 * Each previously carried its own `?? 2`, which meant a company with no row
 * could in principle have been told one figure on screen and paid against
 * another, and changing the default meant finding every literal.
 */

import { prisma } from './prisma';

/** Used only when a company has no PermissionPolicy row of its own. */
export const DEFAULT_FREE_HOURS_PER_MONTH = 2;

export async function getFreeHoursPerMonth(companyId: number): Promise<number> {
  const policy = await prisma.permissionPolicy.findUnique({
    where: { companyId },
    select: { freeHoursPerMonth: true },
  });
  return policy ? Number(policy.freeHoursPerMonth) : DEFAULT_FREE_HOURS_PER_MONTH;
}

/** Same value for a path that starts from an employee rather than a company. */
export async function getFreeHoursPerMonthForEmployee(employeeId: number): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true },
  });
  return employee ? getFreeHoursPerMonth(employee.companyId) : DEFAULT_FREE_HOURS_PER_MONTH;
}
