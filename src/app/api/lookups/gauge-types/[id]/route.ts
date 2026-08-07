import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { GaugeTypeSchema } from "@/lib/validators";

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const body = await req.json();
  const typeOfGauge = String(body.typeOfGauge || body.name || "").trim();
  const parsed = GaugeTypeSchema.partial().safeParse(
    typeOfGauge ? { typeOfGauge } : body
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.typeOfGauge) {
    return NextResponse.json({ error: "typeOfGauge is required" }, { status: 400 });
  }

  const item = await prisma.gaugeType.update({
    where: { rowId: Number(id) },
    data: { typeOfGauge: parsed.data.typeOfGauge },
  });

  return NextResponse.json({ ok: true, item: mapGaugeType(item) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canDeleteMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  await prisma.gaugeType.delete({ where: { rowId: Number(id) } });
  return NextResponse.json({ ok: true });
}
