/**
 * RBAC permission check utility.
 *
 * Permission granularity: module / submodule / page / action
 * e.g. { module: "employee", submodule: "profile", page: "list", action: "view" }
 *
 * A role has access if ANY of its RolePermission rows match the required permission.
 * Wildcard matching: if a Permission has submodule/page = "*", it matches any value.
 */

import { prisma } from './prisma';

export interface PermissionCheck {
  module: string;
  submodule?: string;
  page?: string;
  action: string;
}

/**
 * Check if a role has a specific permission.
 * Caches results in a simple Map for the request lifecycle.
 */
export async function hasPermission(
  roleId: number,
  required: PermissionCheck
): Promise<boolean> {
  const count = await prisma.rolePermission.count({
    where: {
      roleId,
      // A role's grants only apply while the role itself is active and not
      // soft-deleted — otherwise a deactivated/deleted role's holders would
      // keep access for up to 24h (until their JWT expires) since roleId is
      // baked into the token, not re-checked against Role at request time.
      role: { isActive: true, deletedAt: null },
      permission: {
        isActive: true,
        deletedAt: null,
        module: required.module,
        action: required.action,
        OR: [
          { submodule: null },
          { submodule: '*' },
          ...(required.submodule ? [{ submodule: required.submodule }] : []),
        ],
        AND: [
          {
            OR: [
              { page: null },
              { page: '*' },
              ...(required.page ? [{ page: required.page }] : []),
            ],
          },
        ],
      },
    },
  });

  return count > 0;
}

/**
 * Coarse check: does this role hold ANY active permission in a given
 * top-level module (e.g. "admin")? Used for nav-section visibility, where we
 * only need to know "should this section show at all", not a specific
 * submodule/action.
 */
export async function hasAnyPermissionInModule(
  roleId: number,
  module: string
): Promise<boolean> {
  const count = await prisma.rolePermission.count({
    where: {
      roleId,
      role: { isActive: true, deletedAt: null },
      permission: { isActive: true, deletedAt: null, module },
    },
  });

  return count > 0;
}
