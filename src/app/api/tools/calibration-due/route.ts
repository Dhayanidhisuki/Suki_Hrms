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

  const items = await prisma.gaugeAndTools.findMany({
    where: {
      nextCalibrationDate: { lte: alertDate },
      status: { notIn: ["Scrapped", "Under Calibration"] },
    },
    orderBy: { nextCalibrationDate: "asc" },
    include: { calibControlCard: true },
  });

  return NextResponse.json({ items, alertDays });
}
