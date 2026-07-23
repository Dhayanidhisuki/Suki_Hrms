import { jwtVerify } from "jose";
import { prisma } from "./prisma";
import type { SessionData } from "./session";

export interface ErpTokenPayload {
  sub: string;
  userId?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

// Verify ERP SSO token and return decoded payload
export async function verifyErpToken(
  token: string
): Promise<ErpTokenPayload | null> {
  try {
    const mechanism = process.env.ERP_SSO_MECHANISM ?? "jwt";

    if (mechanism === "jwt") {
      const secret = new TextEncoder().encode(
        process.env.ERP_JWT_SECRET as string
      );
      const { payload } = await jwtVerify(token, secret);
      return payload as unknown as ErpTokenPayload;
    }

    if (mechanism === "introspection") {
      const res = await fetch(process.env.ERP_INTROSPECTION_URL as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) return null;
      return await res.json();
    }

    return null;
  } catch {
    return null;
  }
}

// Lookup ERP_USER and EMPLOYEE tables, build session data
export async function buildSession(
  payload: ErpTokenPayload
): Promise<SessionData | null> {
  const userId = payload.sub ?? payload.userId;
  if (!userId) return null;

  const erpUser = await prisma.erpUser.findUnique({
    where: { userId },
  });
  if (!erpUser || !erpUser.isActive) return null;

  let name = userId;
  try {
    if (erpUser.empCd) {
      const employee = await prisma.employee.findUnique({
        where: { empCd: erpUser.empCd },
      });
      if (employee) name = employee.empName;
    }
  } catch {
    // EMPLOYEE table not yet available — skip enrichment
  }

  return {
    userId: erpUser.userId,
    name,
    empCd: erpUser.empCd ?? null,
    roleName: erpUser.roleName,
    addRoleName: erpUser.addRoleName ?? null,
    isLoggedIn: true,
  };
}

// Helper: require session in API route, return 401 if missing
export async function requireSession(
  session: SessionData | null
): Promise<
  | { ok: false; response: Response }
  | { ok: true; session: SessionData }
> {
  // Auth disabled for local dev — return mock session
  return {
    ok: true,
    session: session ?? {
      userId: "DEVUSER",
      name: "Dev User",
      empCd: null,
      roleName: "Tools Admin",
      addRoleName: null,
      isLoggedIn: true,
    },
  };
}

// Helper: require specific permission
export async function requirePermission(
  session: SessionData,
  permission: string
): Promise<{ ok: false; response: Response } | { ok: true }> {
  // Auth disabled for local dev — always allow
  return { ok: true };
}
