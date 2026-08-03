import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const items = await prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(`SELECT TOP 20 * FROM COMPANY_DETAILS ORDER BY COMPANY_NAME`);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching company details:", error);
    return NextResponse.json({ items: [], error: "Failed to load company settings" }, { status: 500 });
  }
}
