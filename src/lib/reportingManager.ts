/**
 * Resolves "which Employee am I" for the logged-in user (via Employee.userId
 * — see schema.prisma's User<->Employee 1:1) and hierarchy checks built on
 * Employee.reportingManagerId and Employee.secondReportingManagerId.
 *
 * Two-level reporting management:
 *   Level 1 — reportingManagerId (direct manager)
 *   Level 2 — secondReportingManagerId (skip-level / second manager)
 *
 * Used by approval workflows (Mispunch, OT, Leave, Permission, Salary
 * Revision, Confirmation) whose first stage is hierarchy-gated — only the
 * requester's own Reporting Manager (Level 1 or Level 2) may act — unlike
 * purely RBAC-permission-gated routes (see checkSpecificPermission in
 * rbac-employee.ts for that pattern instead).
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

/** True when `managerEmployeeId` is the current (not historical) Level-1 reportingManagerId of `employeeId`. */
export async function isReportingManagerOf(managerEmployeeId: number, employeeId: number): Promise<boolean> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { reportingManagerId: true },
  });
  return employee?.reportingManagerId === managerEmployeeId;
}

/**
 * True when `managerEmployeeId` is the current Level-2
 * (skip-level) secondReportingManagerId of `employeeId`.
 */
export async function isSecondLevelManagerOf(managerEmployeeId: number, employeeId: number): Promise<boolean> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { secondReportingManagerId: true },
  });
  return employee?.secondReportingManagerId === managerEmployeeId;
}

/**
 * True when `managerEmployeeId` is either the Level-1 or Level-2 manager
 * of `employeeId`. Convenience for approval workflows that accept either
 * level as the first-stage approver.
 */
export async function isManagerOfAnyLevel(managerEmployeeId: number, employeeId: number): Promise<boolean> {
  const [l1, l2] = await Promise.all([
    isReportingManagerOf(managerEmployeeId, employeeId),
    isSecondLevelManagerOf(managerEmployeeId, employeeId),
  ]);
  return l1 || l2;
}

/** Every active employee currently reporting to `managerEmployeeId` — e.g. for a PMS Incentive entry form's employee picker. */
export async function listDirectReports(managerEmployeeId: number) {
  return prisma.employee.findMany({
    where: { reportingManagerId: managerEmployeeId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}

/**
 * Every active employee whose secondReportingManagerId is `managerEmployeeId`
 * — the Level-2 (skip-level) reports.
 */
export async function listSecondLevelReports(managerEmployeeId: number) {
  return prisma.employee.findMany({
    where: { secondReportingManagerId: managerEmployeeId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}

/**
 * Get the full reporting chain for an employee, from their direct manager
 * up to the top. Stops at null manager or depth 50 (cycle guard).
 * Returns array of { id, employeeCode, firstName, lastName, level } where
 * level 1 = direct manager, level 2 = manager's manager, etc.
 */
export async function getReportingChain(
  employeeId: number
): Promise<Array<{ id: number; employeeCode: string; firstName: string; lastName: string; level: number }>> {
  const chain: Array<{ id: number; employeeCode: string; firstName: string; lastName: string; level: number }> = [];
  let currentId: number | null = employeeId;
  let level = 0;

  for (let depth = 0; depth < 50 && currentId !== null; depth++) {
    const emp: { id: number; employeeCode: string; firstName: string; lastName: string; reportingManagerId: number | null } | null = await prisma.employee.findFirst({
      where: { id: currentId, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true },
    });
    if (!emp || !emp.reportingManagerId) break;
    level++;
    chain.push({
      id: emp.reportingManagerId,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      level,
    });
    currentId = emp.reportingManagerId;
  }
  return chain;
}

/**
 * List ALL reports recursively (Level 1 + Level 2 + their reports, etc.).
 * Used for org chart, headcount, and "my org" views. Cycle/depth guarded.
 */
export async function listAllReports(
  managerId: number
): Promise<Array<{ id: number; employeeCode: string; firstName: string; lastName: string; reportingManagerId: number | null; secondReportingManagerId: number | null }>> {
  const all: Array<{ id: number; employeeCode: string; firstName: string; lastName: string; reportingManagerId: number | null; secondReportingManagerId: number | null }> = [];
  const visited = new Set<number>();
  await collectReports(managerId, all, visited, 0);
  return all;
}

async function collectReports(
  managerId: number,
  results: Array<{ id: number; employeeCode: string; firstName: string; lastName: string; reportingManagerId: number | null; secondReportingManagerId: number | null }>,
  visited: Set<number>,
  depth: number
) {
  if (depth > 20 || visited.has(managerId)) return; // cycle/depth guard
  visited.add(managerId);

  const direct = await prisma.employee.findMany({
    where: { reportingManagerId: managerId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true, secondReportingManagerId: true },
  });

  for (const emp of direct) {
    results.push(emp);
    await collectReports(emp.id, results, visited, depth + 1);
  }
}

/**
 * Bulk reassign: when a manager leaves, move all their direct reports
 * to a new manager. Also clears secondReportingManagerId if it points
 * to the departing manager. Returns the count of reassigned Level-1 reports.
 */
export async function reassignAllReports(
  oldManagerId: number,
  newManagerId: number | null
): Promise<{ reassigned: number }> {
  const result = await prisma.employee.updateMany({
    where: { reportingManagerId: oldManagerId, deletedAt: null },
    data: { reportingManagerId: newManagerId },
  });

  // Also clear second-level if it pointed to old manager
  await prisma.employee.updateMany({
    where: { secondReportingManagerId: oldManagerId, deletedAt: null },
    data: { secondReportingManagerId: newManagerId },
  });

  return { reassigned: result.count };
}

/**
 * Cycle detection for reportingManagerId — walks the candidate's own
 * manager chain up to 50 levels, returning true if `employeeId` appears
 * (which would create a circular hierarchy).
 */
export async function wouldCreateCycle(employeeId: number, candidateManagerId: number): Promise<boolean> {
  if (candidateManagerId === employeeId) return true;
  let currentId: number | null = candidateManagerId;
  for (let depth = 0; depth < 50 && currentId !== null; depth++) {
    const manager: { reportingManagerId: number | null } | null = await prisma.employee.findUnique({
      where: { id: currentId },
      select: { reportingManagerId: true },
    });
    if (!manager) break;
    if (manager.reportingManagerId === employeeId) return true;
    currentId = manager.reportingManagerId;
  }
  return false;
}

/**
 * Cycle detection for secondReportingManagerId — same pattern as
 * wouldCreateCycle but checks both Level-1 and Level-2 fields when
 * walking the chain.
 */
export async function wouldCreateSecondLevelCycle(
  employeeId: number,
  candidateManagerId: number
): Promise<boolean> {
  if (candidateManagerId === employeeId) return true;
  let currentId: number | null = candidateManagerId;
  for (let depth = 0; depth < 50 && currentId !== null; depth++) {
    const manager: { reportingManagerId: number | null; secondReportingManagerId: number | null } | null = await prisma.employee.findFirst({
      where: { id: currentId, deletedAt: null },
      select: { reportingManagerId: true, secondReportingManagerId: true },
    });
    if (!manager) break;
    if (manager.reportingManagerId === employeeId) return true;
    if (manager.secondReportingManagerId === employeeId) return true;
    currentId = manager.reportingManagerId ?? manager.secondReportingManagerId;
  }
  return false;
}
