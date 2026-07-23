import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ toolOrGaugeNo: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { toolOrGaugeNo } = await params;

  const history = await prisma.gaugeControlCardTrans.findMany({
    where: { toolOrGaugeNo },
    orderBy: { calibrationDate: "desc" },
  });

  const controlCard = await prisma.gaugeControlCard.findUnique({
    where: { toolOrGaugeNo },
  });

  return NextResponse.json({ toolOrGaugeNo, controlCard, history });
}
