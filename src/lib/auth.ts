import { NextResponse } from "next/server";
import type { SessionData } from "./session";
import { isAdminRole } from "./adminRoles";
import { checkLegacyPermission } from "./rbac";

const UNAUTHORIZED = NextResponse.json(
  { success: false, error: "Unauthorized" },
  { status: 401 }
);

const FORBIDDEN = NextResponse.json(
  { success: false, error: "Forbidden" },
  { status: 403 }
);

/**
 * Require an authenticated JWT session in API routes.
 * Pair with getSession() — middleware also gates /api/*, this is defense in depth.
 */
export async function requireSession(
  session: SessionData | null
): Promise<
  | { ok: false; response: Response }
  | { ok: true; session: SessionData }
> {
  if (!session?.isLoggedIn || !session.userId) {
    return { ok: false, response: UNAUTHORIZED };
  }
  return { ok: true, session };
}

/**
 * Require a role permission from TOOLS_ROLE_PERMISSION (cached),
 * with hardcoded rolePermissions.ts fallback via permissionsCache.
 * Unknown permission keys (and legacy "canManageTools") map to canEditMaster.
 * MANAGE_USERS maps to canManageUsers.
 */
export async function requirePermission(
  session: SessionData,
  permission: string
): Promise<{ ok: false; response: Response } | { ok: true }> {
  // Admin bypass is role-based only.
  //
  // The previous `userId.startsWith("demo")` clause granted EVERY permission to
  // any account whose username began with "demo", regardless of its role — so a
  // demo user downgraded to Viewer still passed every server-side check. Removed.
  if (isAdminRole(session.roleName)) {
    return { ok: true };
  }

  const allowed = await checkLegacyPermission(session, permission);
  if (!allowed) {
    return { ok: false, response: FORBIDDEN };
  }
  return { ok: true };
}
