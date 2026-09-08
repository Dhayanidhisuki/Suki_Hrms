/**
 * Resolves "which Employee am I" for the logged-in user (via Employee.userId
 * — see schema.prisma's User<->Employee 1:1) and hierarchy checks built on
 * Employee.reportingManagerId. Used by the Mispunch Correction workflow's
 * first approval stage, which is hierarchy-gated (only the requester's own
 * Reporting Manager may act), unlike every other approval in this app
 * (Leave, etc.) which is purely RBAC-permission-gated — see
 * checkSpecificPermission in rbac-employee.ts for that pattern instead.
 */

import { prisma } from './prisma';

/** The Employee record for the given login, or null if this user has none (e.g. a pure admin account). */
export async function resolveOwnEmployeeId(userId: number): Promise<number | null> {
  const employee = await prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  return employee?.id ?? null;
}

/** True when `managerEmployeeId` is the current (not historical) reportingManagerId of `employeeId`. */
export async function isReportingManagerOf(managerEmployeeId: number, employeeId: number): Promise<boolean> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { reportingManagerId: true },
  });
  return employee?.reportingManagerId === managerEmployeeId;
}

/** Every active employee currently reporting to `managerEmployeeId` — e.g. for a PMS Incentive entry form's employee picker. */
export async function listDirectReports(managerEmployeeId: number) {
  return prisma.employee.findMany({
    where: { reportingManagerId: managerEmployeeId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}
