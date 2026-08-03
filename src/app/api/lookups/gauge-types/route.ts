import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { GaugeTypeSchema } from "@/lib/validators";

const FALLBACK_GAUGE_TYPES = [
  { id: 1, code: "GT-01", name: "Plug Gauge", description: "Thread Plug & Plain Cylindrical Plug" },
  { id: 2, code: "GT-02", name: "Ring Gauge", description: "Thread Ring & Plain Ring Go/No-Go" },
  { id: 3, code: "GT-03", name: "Snap Gauge", description: "Adjustable & Solid Snap Gauges" },
  { id: 4, code: "GT-04", name: "Dial Indicator", description: "Dial Test Indicators & Height Gauges" },
  { id: 5, code: "GT-05", name: "Bore Gauge", description: "Two-point & Three-point Internal Bore Gauges" },
];

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rawItems = await prisma.gaugeType.findMany({
      orderBy: { creatDt: "desc" },
    });

    if (rawItems.length === 0) {
      return NextResponse.json({ items: FALLBACK_GAUGE_TYPES });
    }

    const items = rawItems.map((item) => ({
      id: item.rowId,
      code: `GT-${String(item.rowId).padStart(2, "0")}`,
      name: item.typeOfGauge || "Unnamed Gauge Type",
      description: null,
      rowId: item.rowId,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching gauge types:", error);
    return NextResponse.json({ items: FALLBACK_GAUGE_TYPES });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = GaugeTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await prisma.gaugeType.create({
      data: {
        typeOfGauge: body.name || body.typeOfGauge || body.code,
        creatUserIdCd: authCheck.session.userId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        item: {
          id: item.rowId,
          code: `GT-${String(item.rowId).padStart(2, "0")}`,
          name: item.typeOfGauge,
          description: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating gauge type:", error);
    return NextResponse.json({ error: "Failed to create gauge type" }, { status: 500 });
  }
}
