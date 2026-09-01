import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { GaugeTypeSchema } from "@/lib/validators";
import { checkModulePermission } from "@/lib/rbac";

function mapGaugeType(item: {
  rowId: number;
  typeOfGauge: string;
  creatUserIdCd: string;
  creatDt: Date | null;
}) {
  return {
    id: item.rowId,
    rowId: item.rowId,
    code: `GT-${String(item.rowId).padStart(2, "0")}`,
    name: item.typeOfGauge || "Unnamed Gauge Type",
    typeOfGauge: item.typeOfGauge,
    creatUserIdCd: item.creatUserIdCd,
    creatDt: item.creatDt,
  };
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const rawItems = await prisma.gaugeType.findMany({
      orderBy: { creatDt: "desc" },
    });

    return NextResponse.json({ items: rawItems.map(mapGaugeType) });
  } catch (error) {
    console.error("Error fetching gauge types:", error);
    return NextResponse.json({ items: [], error: "Failed to load gauge types" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "gauge_type", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const typeOfGauge = String(body.typeOfGauge || body.name || body.code || "").trim();
  const parsed = GaugeTypeSchema.safeParse({ typeOfGauge });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await prisma.gaugeType.create({
      data: {
        typeOfGauge: parsed.data.typeOfGauge,
        creatUserIdCd: authCheck.session.userId,
        creatDt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, item: mapGaugeType(item) }, { status: 201 });
  } catch (error) {
    console.error("Error creating gauge type:", error);
    return NextResponse.json({ error: "Failed to create gauge type" }, { status: 500 });
  }
}
