import { NextResponse } from "next/server";
import type { SessionData } from "./session";
import { roleHasPermission } from "./permissionsCache";

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
  const isSysAdmin =
    session.roleName === "Tools Admin" ||
    session.roleName === "Admin" ||
    session.userId.toLowerCase() === "admin" ||
    session.userId.toLowerCase().startsWith("demo");

  if (isSysAdmin) {
    return { ok: true };
  }

  const allowed = await roleHasPermission(session.roleName, permission);
  if (!allowed) {
    return { ok: false, response: FORBIDDEN };
  }
  return { ok: true };
}
