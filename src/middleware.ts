import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthTokenEdge } from "./lib/authTokenEdge";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/auth/session-expired") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/static")) return true;
  if (pathname === "/favicon.ico") return true;
  // Next metadata file conventions (app/icon.*, app/apple-icon.*)
  if (pathname === "/icon" || pathname.startsWith("/icon/")) return true;
  if (pathname === "/apple-icon" || pathname.startsWith("/apple-icon/")) return true;
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(pathname)) return true;
  return false;
}

function loginRedirectUrl(req: NextRequest): URL {
  const url = new URL("/login", req.url);
  const dest = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (dest && dest !== "/" && dest !== "/login") {
    url.searchParams.set("redirect", dest);
  }
  return url;
}

function clearAuthCookie(res: NextResponse, secure: boolean) {
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function requestIsHttps(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto.toLowerCase() === "https";
  return req.nextUrl.protocol === "https:";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const auth = await verifyAuthTokenEdge(token);
  const secureCookie = requestIsHttps(req);

  // Logged-in users hitting /login → send them onward
  if (pathname === "/login" && auth.status === "ok") {
    const redirectParam = req.nextUrl.searchParams.get("redirect");
    const dest =
      redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
        ? redirectParam
        : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (auth.status === "ok") {
    return NextResponse.next();
  }

  // Token present but expired/invalid → session-expired UX
  if (auth.status === "invalid") {
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
      clearAuthCookie(res, secureCookie);
      return res;
    }
    const res = NextResponse.redirect(new URL("/auth/session-expired", req.url));
    clearAuthCookie(res, secureCookie);
    return res;
  }

  // No token
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.redirect(loginRedirectUrl(req));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
