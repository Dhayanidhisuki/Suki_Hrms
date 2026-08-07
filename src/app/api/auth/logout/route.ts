import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  requestIsHttps,
} from "@/lib/authToken";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.json({ success: true });
    // Expire the JWT cookie immediately
    res.cookies.set(AUTH_COOKIE_NAME, "", {
      ...authCookieOptions(0, { secure: requestIsHttps(req) }),
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
