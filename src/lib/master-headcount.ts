import { prisma } from '@/lib/prisma';

/**
 * "Current headcount" for Department / Sub-Department / Designation / Level /
 * Employee-Type masters (KUN BRD review, 2026-09-10) — the number of active
 * employees currently assigned there, derived at read time rather than
 * stored. Sits alongside each master's stored `sanctionedHeadcount` where one
 * exists.
 *
 * Counts the CURRENT JobInfo row (effectiveTo: null) of employees who are
 * not soft-deleted and not deactivated — matches how the rest of the app
 * scopes "active employee".
 *
 * `departmentId`/`designationId`/`employeeTypeId` on JobInfo are required
 * (every row has one), so filtering them "not null" is itself invalid Prisma
 * for a non-nullable Int field. `subDepartmentId`/`levelId` are nullable and
 * need the exclusion.
 */
const NULLABLE_FIELDS = new Set(['subDepartmentId', 'levelId']);

export async function currentHeadcounts(
  field: 'departmentId' | 'subDepartmentId' | 'designationId' | 'levelId' | 'employeeTypeId'
): Promise<Map<number, number>> {
  const groups = await prisma.jobInfo.groupBy({
    by: [field],
    where: {
      effectiveTo: null,
      ...(NULLABLE_FIELDS.has(field) ? { NOT: { [field]: null } } : {}),
      employee: { deletedAt: null, isActive: true },
    },
    _count: { _all: true },
  });
  const map = new Map<number, number>();
  for (const g of groups) {
    const key = g[field] as number | null;
    if (key != null) map.set(key, g._count._all);
  }
  return map;
}
