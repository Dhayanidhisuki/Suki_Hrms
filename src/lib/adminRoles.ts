/**
 * Single source of truth for "is this role a system administrator?".
 *
 * Edge-safe: no Prisma / Node-only imports, so `src/middleware.ts` can use it.
 *
 * Settings (`/dashboard/settings/**` and its APIs) is restricted to these roles.
 * Every other role — Store Keeper, Calibration Engineer, Purchase Coordinator,
 * Viewer, Quality Manager, Quality Engineer — is denied.
 */

/** Roles granted full app access. Kept in sync with permissionsCache.FULL_ACCESS_ROLES. */
export const ADMIN_ROLES: readonly string[] = [
  "Tools Admin",
  "Administrator",
  "Admin",
  "admin",
];

const ADMIN_ROLE_SET = new Set(ADMIN_ROLES.map((r) => r.toLowerCase()));

/** True only for system-admin roles. Trims + case-insensitive to survive dirty DB values. */
export function isAdminRole(role: string | null | undefined): boolean {
  if (typeof role !== "string") return false;
  return ADMIN_ROLE_SET.has(role.trim().toLowerCase());
}

/**
 * Route prefixes that only admins may reach.
 * Checked with `=== prefix || startsWith(prefix + "/")` so `/dashboard/settings-foo`
 * is never accidentally captured.
 */
export const ADMIN_ONLY_PREFIXES: readonly string[] = [
  "/dashboard/settings",
  "/api/settings",
  "/api/users",
  "/api/roles-permissions",
];

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
