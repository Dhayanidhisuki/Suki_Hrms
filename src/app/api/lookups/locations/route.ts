import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** LOCATION_MASTER — ERP source for Location Name dropdown on Tool create. */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        ROW_ID: number;
        LOCATION_TYPE: string | null;
        LOCATION_NAME: string | null;
        AREA: string | null;
        RACK: string | null;
      }>
    >(
      `SELECT ROW_ID, LOCATION_TYPE, LOCATION_NAME, AREA, RACK
       FROM LOCATION_MASTER
       WHERE LOCATION_NAME IS NOT NULL
         AND LTRIM(RTRIM(LOCATION_NAME)) <> ''
         AND LTRIM(RTRIM(LOCATION_NAME)) <> '-Select-'
       ORDER BY LOCATION_NAME`
    );

    const items = rows.map((r) => ({
      id: r.ROW_ID,
      locationType: r.LOCATION_TYPE,
      locationName: r.LOCATION_NAME,
      area: r.AREA && r.AREA !== "-Select-" ? r.AREA : null,
      rack: r.RACK && r.RACK !== "-Select-" ? r.RACK : null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/lookups/locations failed:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load locations" },
      { status: 500 }
    );
  }
}
