import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** UOM_MASTER — distinct UOM values for Tool create dropdown. */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ UOM: string }>>(
      `SELECT DISTINCT UOM
       FROM UOM_MASTER
       WHERE UOM IS NOT NULL AND LTRIM(RTRIM(UOM)) <> ''
       ORDER BY UOM`
    );

    return NextResponse.json({
      items: rows.map((r) => ({ uom: r.UOM, name: r.UOM })),
    });
  } catch (error) {
    console.error("GET /api/lookups/uom failed:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load UOM list" },
      { status: 500 }
    );
  }
}
