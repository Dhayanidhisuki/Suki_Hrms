/**
 * Shared salary-versioning logic — closes whatever EmployeeSalaryRevision is
 * currently active (effectiveTo = the new row's effectiveFrom) and creates
 * the new version + its EmployeeSalaryComponent rows, so the two ranges meet
 * but never overlap. tr_EmployeeSalaryRevision_no_overlap is the DB-level
 * backstop if this logic is ever bypassed. Revisions are immutable history —
 * no update/delete.
 *
 * Used by both POST /api/employees/[id]/salary (direct entry) and the
 * Salary Revision approval flow (src/app/api/payroll/revisions/[id]/approve),
 * so a revision created either way behaves identically to Payroll.
 */

import type { Prisma } from '@prisma/client';

export interface ApplySalaryRevisionInput {
  employeeId: number;
  financialYear?: string | null;
  grossSalary: number;
  netSalary?: number | null;
  effectiveFrom: Date;
  components: { salaryComponentId: number; amount: number }[];
  performedByUserId: number | null;
}

export async function applySalaryRevision(tx: Prisma.TransactionClient, input: ApplySalaryRevisionInput) {
  const { employeeId, financialYear, grossSalary, netSalary, effectiveFrom, components, performedByUserId } = input;

  const current = await tx.employeeSalaryRevision.findFirst({ where: { employeeId, effectiveTo: null } });
  if (current && effectiveFrom <= current.effectiveFrom) {
    throw new Error('A new revision must be effective after the current revision\'s effective date.');
  }

  if (current) {
    await tx.employeeSalaryRevision.update({ where: { id: current.id }, data: { effectiveTo: effectiveFrom } });
  }

  const revision = await tx.employeeSalaryRevision.create({
    data: {
      employeeId,
      financialYear: financialYear ?? null,
      grossSalary,
      netSalary: netSalary ?? null,
      effectiveFrom,
      lastUpdatedByUserId: performedByUserId,
      components: { create: components.map((c) => ({ salaryComponentId: c.salaryComponentId, amount: c.amount })) },
    },
    include: { components: { include: { salaryComponent: { select: { name: true, code: true, type: true } } } } },
  });

  return revision;
}
