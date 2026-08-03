import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./authToken";

export interface SessionData {
  userId: string;
  name: string;
  empCd: string | null;
  roleName: string;
  addRoleName: string | null;
  isLoggedIn: boolean;
  /** Numeric TOOLS_APP_USER.id when authenticated via JWT */
  userDbId: number | null;
}

function emptySession(): SessionData {
  return {
    userId: "",
    name: "",
    empCd: null,
    roleName: "",
    addRoleName: null,
    isLoggedIn: false,
    userDbId: null,
  };
}

function sessionFromToken(token: string | undefined): SessionData {
  if (!token) return emptySession();
  const payload = verifyAuthToken(token);
  if (!payload) return emptySession();
  return {
    userId: payload.username,
    name: payload.name,
    empCd: null,
    roleName: payload.role,
    addRoleName: null,
    isLoggedIn: true,
    userDbId: payload.sub,
  };
}

/** Read authenticated session from the JWT auth cookie (Node route handlers). */
export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  return sessionFromToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

/** Read authenticated session from a request cookie jar (middleware / edge-adjacent). */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionData> {
  return sessionFromToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
}

// Re-export role matrix for server callers
export { rolePermissions, type UserRole } from "./rolePermissions";
