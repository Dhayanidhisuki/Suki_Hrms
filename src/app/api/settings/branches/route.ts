import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const [locations, companyIds, fromUnits] = await Promise.all([
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT ROW_ID, LOCATION_TYPE, LOCATION_NAME, RACK, AREA, CREAT_USER_ID_CD, CREAT_DT
        FROM LOCATION_MASTER
        WHERE LOCATION_TYPE = 'Item/Asset'
        ORDER BY LOCATION_NAME
      `),
      prisma.$queryRawUnsafe<Array<{ COMPANY_ID: string | null }>>(`
        SELECT DISTINCT COMPANY_ID FROM GAUGEANDTOOLS
      `),
      prisma.$queryRawUnsafe<Array<{ FROM_UNIT: string | null }>>(`
        SELECT DISTINCT FROM_UNIT FROM GAUGE_TOOLS_ISSUE
      `),
    ]);

    return NextResponse.json({
      locations,
      companyIds: companyIds.map((r) => r.COMPANY_ID).filter(Boolean),
      fromUnits: fromUnits.map((r) => r.FROM_UNIT).filter((v) => v != null && String(v).trim() !== ""),
    });
  } catch (error) {
    console.error("Error fetching branch settings:", error);
    return NextResponse.json(
      { locations: [], companyIds: [], fromUnits: [], error: "Failed to load branch settings" },
      { status: 500 }
    );
  }
}
