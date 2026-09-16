/**
 * Data scope (BRD 01 §20): ACCESS = ROLE × DATA SCOPE.
 *
 * A user holds zero or more active `UserScope` rows; the employees they can
 * see are the UNION of those scopes plus the implicit SELF scope (their own
 * employee record). A user with no scope rows sees SELF only. GLOBAL and
 * COMPANY mean "every employee of the company" (the caller has already
 * scoped the query to the company via getCompanyId). Superadmin bypasses
 * scope entirely — the caller checks `x-is-superadmin`.
 *
 * `visibleEmployeeWhere` returns a Prisma `where` fragment so the predicate
 * is applied in the database query, never by filtering after an unscoped
 * read (§20.3 rule 4). Hierarchy scopes (BUSINESS_UNIT / UNIT / SITE /
 * LOCATION) resolve down to Location ids (plus Unit ids for the legacy
 * JobInfo.unitId posting) against the employee's current job row.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ScopeType } from '@/lib/validations/employee-master';

export type ScopeRow = { scopeType: string; scopeValues: string | null; treeDepth: string | null };

export function parseScopeValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isUnrestricted(scopes: ScopeRow[]): boolean {
  return scopes.some((s) => s.scopeType === 'GLOBAL' || s.scopeType === 'COMPANY');
}

export async function loadUserScopes(userId: number, companyId: number): Promise<ScopeRow[]> {
  return prisma.userScope.findMany({
    where: { userId, companyId, isActive: true },
    select: { scopeType: true, scopeValues: true, treeDepth: true },
  });
}

export async function ownEmployeeId(userId: number, companyId: number): Promise<number | null> {
  const emp = await prisma.employee.findFirst({ where: { userId, companyId, deletedAt: null }, select: { id: true } });
  return emp?.id ?? null;
}

/**
 * Employee ids below `rootId` in the primary reporting chain. DIRECT = one
 * level; ALL = the whole downward tree, capped at `maxDepth` levels.
 */
export async function collectReportingTree(
  companyId: number,
  rootId: number,
  depth: 'DIRECT' | 'ALL',
  maxDepth = 10
): Promise<number[]> {
  const seen = new Set<number>([rootId]);
  const out: number[] = [];
  let frontier = [rootId];
  const levels = depth === 'DIRECT' ? 1 : maxDepth;
  for (let level = 0; level < levels && frontier.length > 0; level++) {
    const rows = await prisma.employee.findMany({
      where: { companyId, deletedAt: null, reportingManagerId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r.id);
      frontier.push(r.id);
    }
  }
  return out;
}

/** Location ids (and, for BU/UNIT, unit ids) that a hierarchy scope resolves to. */
async function resolveHierarchy(
  companyId: number,
  scopeType: ScopeType,
  codes: string[]
): Promise<{ locationIds: number[]; unitIds: number[] }> {
  if (codes.length === 0) return { locationIds: [], unitIds: [] };
  let unitIds: number[] = [];
  let siteIds: number[] = [];
  let locationIds: number[] = [];

  if (scopeType === 'BUSINESS_UNIT') {
    const bus = await prisma.businessUnit.findMany({ where: { companyId, code: { in: codes }, deletedAt: null }, select: { id: true } });
    const units = await prisma.unit.findMany({ where: { companyId, businessUnitId: { in: bus.map((b) => b.id) }, deletedAt: null }, select: { id: true } });
    unitIds = units.map((u) => u.id);
  } else if (scopeType === 'UNIT') {
    const units = await prisma.unit.findMany({ where: { companyId, code: { in: codes }, deletedAt: null }, select: { id: true } });
    unitIds = units.map((u) => u.id);
  } else if (scopeType === 'SITE') {
    const sites = await prisma.site.findMany({ where: { companyId, code: { in: codes }, deletedAt: null }, select: { id: true } });
    siteIds = sites.map((s) => s.id);
  } else if (scopeType === 'LOCATION') {
    const locations = await prisma.location.findMany({ where: { companyId, code: { in: codes }, deletedAt: null }, select: { id: true } });
    locationIds = locations.map((l) => l.id);
  }

  if (unitIds.length > 0 && siteIds.length === 0) {
    const sites = await prisma.site.findMany({ where: { companyId, unitId: { in: unitIds }, deletedAt: null }, select: { id: true } });
    siteIds = sites.map((s) => s.id);
  }
  if (siteIds.length > 0 && locationIds.length === 0) {
    const locations = await prisma.location.findMany({ where: { companyId, siteId: { in: siteIds }, deletedAt: null }, select: { id: true } });
    locationIds = locations.map((l) => l.id);
  }
  return { locationIds, unitIds };
}

/**
 * Prisma `where` fragment for `Employee` restricting to what the user may
 * see. `{}` when unrestricted; `{ id: -1 }` when nothing is visible.
 */
export async function visibleEmployeeWhere(
  userId: number,
  companyId: number,
  opts: { isSuperAdmin?: boolean } = {}
): Promise<Prisma.EmployeeWhereInput> {
  if (opts.isSuperAdmin) return {};

  const scopes = await loadUserScopes(userId, companyId);
  if (isUnrestricted(scopes)) return {};

  const fragments: Prisma.EmployeeWhereInput[] = [];
  const selfId = await ownEmployeeId(userId, companyId);
  if (selfId !== null) fragments.push({ id: selfId });

  for (const scope of scopes) {
    const values = parseScopeValues(scope.scopeValues);
    switch (scope.scopeType as ScopeType) {
      case 'BUSINESS_UNIT':
      case 'UNIT':
      case 'SITE':
      case 'LOCATION': {
        const { locationIds, unitIds } = await resolveHierarchy(companyId, scope.scopeType as ScopeType, values);
        const or: Prisma.JobInfoWhereInput[] = [];
        if (locationIds.length) or.push({ locationId: { in: locationIds } });
        if (unitIds.length) or.push({ unitId: { in: unitIds } });
        if (or.length) fragments.push({ jobInfos: { some: { effectiveTo: null, OR: or } } });
        break;
      }
      case 'DEPARTMENT':
        if (values.length) fragments.push({ jobInfos: { some: { effectiveTo: null, department: { code: { in: values } } } } });
        break;
      case 'SUB_DEPARTMENT':
        if (values.length) fragments.push({ jobInfos: { some: { effectiveTo: null, subDepartment: { code: { in: values } } } } });
        break;
      case 'COST_CENTRE': {
        if (!values.length) break;
        const ccs = await prisma.costCentre.findMany({ where: { companyId, code: { in: values }, deletedAt: null }, select: { id: true } });
        if (ccs.length) fragments.push({ jobInfos: { some: { effectiveTo: null, costCentreId: { in: ccs.map((c) => c.id) } } } });
        break;
      }
      case 'REPORTING_TREE': {
        if (selfId === null) break;
        const ids = await collectReportingTree(companyId, selfId, scope.treeDepth === 'ALL' ? 'ALL' : 'DIRECT');
        if (ids.length) fragments.push({ id: { in: ids } });
        break;
      }
      case 'EMPLOYEE_LIST':
        if (values.length) fragments.push({ employeeCode: { in: values } });
        break;
      default:
        break;
    }
  }

  if (fragments.length === 0) return { id: -1 };
  return { OR: fragments };
}

/** True when the employee is inside the user's visible set (direct navigation check, §20.3 rule 5). */
export async function canSeeEmployee(
  userId: number,
  companyId: number,
  employeeId: number,
  opts: { isSuperAdmin?: boolean } = {}
): Promise<boolean> {
  const where = await visibleEmployeeWhere(userId, companyId, opts);
  const hit = await prisma.employee.findFirst({
    where: { AND: [{ id: employeeId, companyId, deletedAt: null }, where] },
    select: { id: true },
  });
  return hit !== null;
}

/** Headers → scope context; kept here so every route reads them the same way. */
export function scopeContextFromHeaders(headers: Headers): { userId: number; isSuperAdmin: boolean } {
  return {
    userId: Number(headers.get('x-user-id')) || 0,
    isSuperAdmin: headers.get('x-is-superadmin') === 'true',
  };
}
