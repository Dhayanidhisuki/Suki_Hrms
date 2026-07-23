import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "./lib/session";

// Paths that do NOT require a session
const PUBLIC_PATHS = ["/api/auth/verify", "/auth/session-expired"];

export async function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
