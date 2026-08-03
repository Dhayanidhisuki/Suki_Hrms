import { NextResponse } from "next/server";
import type { SessionData } from "./session";
import { rolePermissions } from "./rolePermissions";

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
 * Require a role permission from rolePermissions.
 * Unknown permission keys (and legacy "canManageTools") map to canEditMaster.
 */
const FULL_ACCESS_ROLES = new Set([
  "Tools Admin",
  "Administrator",
  "Admin",
  "admin",
]);

export async function requirePermission(
  session: SessionData,
  permission: string
): Promise<{ ok: false; response: Response } | { ok: true }> {
  if (
    session.userId.toLowerCase() === "admin" ||
    FULL_ACCESS_ROLES.has(session.roleName)
  ) {
    return { ok: true };
  }

  const key = permission === "canManageTools" ? "canEditMaster" : permission;
  const perms = rolePermissions[session.roleName] ?? rolePermissions.Viewer;
  const allowed = Boolean((perms as Record<string, boolean>)[key]);
  if (!allowed) {
    return { ok: false, response: FORBIDDEN };
  }
  return { ok: true };
}
