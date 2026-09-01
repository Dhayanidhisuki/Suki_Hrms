import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSION_KEYS,
  flagsFromRecord,
  rolePermissions,
  type RolePermissionFlags,
} from "@/lib/rolePermissions";

const TTL_MS = 30_000;

type CacheEntry = {
  byRole: Map<string, RolePermissionFlags>;
  expiresAt: number;
};

let cache: CacheEntry | null = null;

const FULL_ACCESS_ROLES = new Set([
  "Tools Admin",
  "Administrator",
  "Admin",
  "admin",
  "Super Admin",
  "super admin",
]);

function emptyFlags(): RolePermissionFlags {
  return { ...rolePermissions.Viewer };
}

function flagsFromRows(
  rows: Array<{ permissionKey: string; allowed: boolean }>
): RolePermissionFlags {
  const record: Record<string, boolean> = {};
  for (const r of rows) {
    record[r.permissionKey] = r.allowed;
  }
  return flagsFromRecord(record);
}

async function loadFromDb(): Promise<Map<string, RolePermissionFlags>> {
  const rows = await prisma.rolePermission.findMany({
    select: { role: true, permissionKey: true, allowed: true },
  });
  const byRole = new Map<string, Array<{ permissionKey: string; allowed: boolean }>>();
  for (const r of rows) {
    const list = byRole.get(r.role) ?? [];
    list.push({ permissionKey: r.permissionKey, allowed: r.allowed });
    byRole.set(r.role, list);
  }
  const map = new Map<string, RolePermissionFlags>();
  for (const [role, list] of byRole) {
    map.set(role, flagsFromRows(list));
  }
  return map;
}

/**
 * Cached role → flags from TOOLS_ROLE_PERMISSION.
 * Falls back to hardcoded rolePermissions.ts if the table is empty or query fails
 * (keeps login/access working before/during seed).
 */
export async function getRolePermissionMap(): Promise<
  Map<string, RolePermissionFlags>
> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.byRole;
  }

  try {
    const byRole = await loadFromDb();
    if (byRole.size === 0) {
      // Pre-seed: use hardcoded matrix
      const fallback = new Map<string, RolePermissionFlags>();
      for (const [role, flags] of Object.entries(rolePermissions)) {
        fallback.set(role, { ...flags });
      }
      cache = { byRole: fallback, expiresAt: now + TTL_MS };
      return fallback;
    }
    cache = { byRole, expiresAt: now + TTL_MS };
    return byRole;
  } catch (err) {
    console.warn(
      "[permissionsCache] DB read failed — using hardcoded rolePermissions:",
      err
    );
    const fallback = new Map<string, RolePermissionFlags>();
    for (const [role, flags] of Object.entries(rolePermissions)) {
      fallback.set(role, { ...flags });
    }
    cache = { byRole: fallback, expiresAt: now + Math.min(TTL_MS, 5_000) };
    return fallback;
  }
}

export function invalidatePermissionsCache(): void {
  cache = null;
}

export async function getPermissionsForRole(
  roleName: string
): Promise<RolePermissionFlags> {
  if (FULL_ACCESS_ROLES.has(roleName)) {
    return { ...rolePermissions["Tools Admin"] };
  }
  const map = await getRolePermissionMap();
  return (
    map.get(roleName) ??
    map.get("Viewer") ??
    emptyFlags()
  );
}

export async function roleHasPermission(
  roleName: string,
  permission: string
): Promise<boolean> {
  if (
    FULL_ACCESS_ROLES.has(roleName)
  ) {
    return true;
  }
  const key =
    permission === "canManageTools"
      ? "canEditMaster"
      : permission === "MANAGE_USERS"
        ? "canManageUsers"
        : permission === "PRICING_APPROVE"
          ? "canApprovePricing"
          : permission === "PO_CREATE"
            ? "canCreatePO"
            : permission === "FINANCE_UPDATE"
              ? "canUpdateFinance"
              : permission;
  const flags = await getPermissionsForRole(roleName);
  return Boolean((flags as Record<string, boolean>)[key]);
}

export function listKnownPermissionKeys(): string[] {
  return [...ALL_PERMISSION_KEYS];
}
