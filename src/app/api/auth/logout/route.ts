import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authCookieOptions } from "@/lib/authToken";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = NextResponse.json({ success: true });
    // Expire the JWT cookie immediately
    res.cookies.set(AUTH_COOKIE_NAME, "", {
      ...authCookieOptions(0),
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
