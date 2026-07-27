import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const alertDays = Number(process.env.CALIBRATION_ALERT_DAYS ?? 30);
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + alertDays);

  // Get tools with calibration due based on GaugeControlCardTrans.nextCDate
  const dueTools = await prisma.gaugeControlCardTrans.findMany({
    where: {
      nextCDate: { lte: alertDate },
    },
    orderBy: { nextCDate: "asc" },
    take: 20,
    include: {
      controlCard: {
        include: {
          tool: {
            select: {
              refNo: true,
              toolOrGaugeNo: true,
              name: true,
              status: true,
              grouping: true,
            },
          },
        },
      },
    },
  });

  const items = dueTools.map((t) => ({
    refNo: t.controlCard.tool?.refNo,
    toolOrGaugeNo: t.controlCard.toolOrGaugeNo,
    name: t.controlCard.tool?.name,
    status: t.controlCard.tool?.status,
    grouping: t.controlCard.tool?.grouping,
    nextCalibrationDate: t.nextCDate,
  }));

  return NextResponse.json({ items });
}
