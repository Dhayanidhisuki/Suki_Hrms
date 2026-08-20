import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ toolOrGaugeNo: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { toolOrGaugeNo } = await params;
  const unitScope = await resolveUnitScope(check.session);
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { toolOrGaugeNo },
    select: { locationName: true },
  });
  if (!tool || !unitIsAllowed(unitScope, tool.locationName)) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const history = await prisma.gaugeControlCardTrans.findMany({
    where: { controlCard: { toolOrGaugeNo } },
    orderBy: { cDate: "desc" },
  });

  const controlCard = await prisma.gaugeControlCard.findUnique({
    where: { toolOrGaugeNo },
  });

  return NextResponse.json({ toolOrGaugeNo, controlCard, history });
}
