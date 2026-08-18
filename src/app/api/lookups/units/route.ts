import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** TOOLS_UNIT_MASTER — Unit dropdown (Unit 1 / Unit 2 / Unit 3 …). */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rows = await prisma.toolsUnitMaster.findMany({
      where: { isActive: true },
      orderBy: { unitName: "asc" },
      select: { id: true, unitName: true },
    });

    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, name: r.unitName })),
    });
  } catch (error) {
    console.error("GET /api/lookups/units failed:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load units" },
      { status: 500 }
    );
  }
}
