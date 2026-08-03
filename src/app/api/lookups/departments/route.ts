import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** DEPT — department dropdown for Tool create. */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ DEPT_NO: number; DEPT_NAME: string | null }>
    >(
      `SELECT DEPT_NO, DEPT_NAME
       FROM DEPT
       WHERE DEPT_NAME IS NOT NULL AND LTRIM(RTRIM(DEPT_NAME)) <> ''
       ORDER BY DEPT_NAME`
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.DEPT_NO,
        name: r.DEPT_NAME,
      })),
    });
  } catch (error) {
    console.error("GET /api/lookups/departments failed:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load departments" },
      { status: 500 }
    );
  }
}
