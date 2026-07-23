import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    // Auth disabled for local dev — return mock session
    return NextResponse.json({
      user: {
        userId: "DEVUSER",
        name: "Dev User",
        empCd: null,
        roleName: "Tools Admin",
        addRoleName: null,
      },
    });
  }
  return NextResponse.json({
    user: {
      userId: session.userId,
      name: session.name,
      empCd: session.empCd,
      roleName: session.roleName,
      addRoleName: session.addRoleName,
    },
  });
}
