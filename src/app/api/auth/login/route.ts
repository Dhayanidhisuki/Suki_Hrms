import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/password";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  requestIsHttps,
  signAuthToken,
} from "@/lib/authToken";
import {
  clearFailedLogins,
  isLoginRateLimited,
  recordFailedLogin,
} from "@/lib/loginGuard";

export const runtime = "nodejs";

const INVALID = { success: false as const, error: "Invalid username or password" };

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(INVALID, { status: 401 });
    }

    const { username, password } = parsed.data;
    const ip = clientIp(req);

    if (isLoginRateLimited(ip, username)) {
      console.warn(
        `[auth] rate-limited login username="${username}" ip="${ip ?? "unknown"}"`
      );
      return NextResponse.json(INVALID, { status: 429 });
    }

    const user = await prisma.user.findFirst({
      where: {
        username,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      recordFailedLogin(ip, username);
      return NextResponse.json(INVALID, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      recordFailedLogin(ip, username);
      return NextResponse.json(INVALID, { status: 401 });
    }

    clearFailedLogins(ip, username);

    const { token, maxAge } = signAuthToken({
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    res.cookies.set(
      AUTH_COOKIE_NAME,
      token,
      authCookieOptions(maxAge, { secure: requestIsHttps(req) })
    );
    return res;
  } catch (err) {
    console.error("Login handler error:", err);
    return NextResponse.json(INVALID, { status: 500 });
  }
}
