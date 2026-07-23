import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { verifyErpToken, buildSession } from "@/lib/auth";
import { VerifyTokenSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifyTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const payload = await verifyErpToken(parsed.data.token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired ERP token" }, { status: 401 });
    }

    const sessionData = await buildSession(payload);
    if (!sessionData) {
      return NextResponse.json({ error: "User not found in ERP_USER table" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = sessionData.userId;
    session.name = sessionData.name;
    session.empCd = sessionData.empCd;
    session.roleName = sessionData.roleName;
    session.addRoleName = sessionData.addRoleName;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ ok: true, user: sessionData }, { status: 200 });
  } catch (err) {
    console.error("[auth/verify]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/session-expired", req.url));
  }

  const payload = await verifyErpToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/auth/session-expired", req.url));
  }

  const sessionData = await buildSession(payload);
  if (!sessionData) {
    return NextResponse.redirect(new URL("/auth/session-expired", req.url));
  }

  const session = await getSession();
  Object.assign(session, sessionData);
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.redirect(new URL("/", req.url));
}
