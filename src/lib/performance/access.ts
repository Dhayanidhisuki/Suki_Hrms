/**
 * Who may touch whose goals — BRD §29 role matrix, narrowed to the goal
 * setting phase.
 *
 *   HR/Admin        — anyone in the company (holds employee.edit)
 *   Reporting mgr   — their own direct reports
 *   Employee        — their own goal set, view + accept/return only
 *
 * Employee.userId is unique, so the acting employee resolves straight from
 * the x-user-id header the proxy injects off the verified JWT.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';

export type GoalActor = {
  userId: number;
  /** The acting user's own employee row, if their login is linked to one. */
  employeeId: number | null;
  isHr: boolean;
};

export async function resolveActor(request: NextRequest, companyId: number): Promise<GoalActor | null> {
  const rawUser = request.headers.get('x-user-id');
  const rawRole = request.headers.get('x-role-id');
  if (!rawUser || !rawRole) return null;

  const userId = Number(rawUser);
  const self = await prisma.employee.findFirst({
    where: { userId, companyId },
    select: { id: true },
  });
  const isHr = await hasPermission(Number(rawRole), { module: 'employee', action: 'edit' });

  return { userId, employeeId: self?.id ?? null, isHr };
}

/**
 * True when the actor may build/edit/submit goals for this employee.
 * Managers are matched on either reporting line — BRD §20's two-level
 * appraisal makes the second manager a legitimate goal owner too.
 */
export async function canManageGoalsFor(actor: GoalActor, companyId: number, employeeId: number): Promise<boolean> {
  if (actor.isHr) return true;
  if (actor.employeeId == null) return false;

  const report = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId,
      OR: [{ reportingManagerId: actor.employeeId }, { secondReportingManagerId: actor.employeeId }],
    },
    select: { id: true },
  });
  return report != null;
}

/** True when the actor is the employee the goal set belongs to. */
export function isGoalOwner(actor: GoalActor, employeeId: number): boolean {
  return actor.employeeId != null && actor.employeeId === employeeId;
}
