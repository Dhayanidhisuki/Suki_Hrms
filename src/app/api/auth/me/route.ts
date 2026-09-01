import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/authToken";
import { getLegacyPermissionFlags, getModuleViewPermissions, getModuleActionPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Session expired" },
      { status: 401 }
    );
  }

  const session = await getSession();
  const permissions = await getLegacyPermissionFlags(session);
  const modulePermissions = await getModuleViewPermissions(session);
  const moduleActionPermissions = await getModuleActionPermissions(session);

  return NextResponse.json({
    user: {
      userId: payload.username,
      name: payload.name,
      empCd: null,
      roleName: payload.role,
      addRoleName: null,
      id: payload.sub,
    },
    permissions,
    modulePermissions,
    moduleActionPermissions,
  });
}
