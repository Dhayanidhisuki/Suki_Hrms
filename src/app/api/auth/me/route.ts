import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/authToken";

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

  return NextResponse.json({
    user: {
      userId: payload.username,
      name: payload.name,
      empCd: null,
      roleName: payload.role,
      addRoleName: null,
      id: payload.sub,
    },
  });
}
