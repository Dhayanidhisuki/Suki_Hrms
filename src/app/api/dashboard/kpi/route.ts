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

  const [
    totalTools,
    currentlyIssued,
    calibrationDue,
    underRepairOrCal,
    groupBreakdown,
    statusBreakdown,
  ] = await Promise.all([
    prisma.gaugeAndTools.count(),
    prisma.gaugeAndTools.count({ where: { status: "Issued" } }),
    prisma.gaugeAndTools.count({
      where: { nextCalibrationDate: { lte: alertDate } },
    }),
    prisma.gaugeAndTools.count({
      where: { status: { in: ["Under Repair", "Under Calibration"] } },
    }),
    prisma.gaugeAndTools.groupBy({
      by: ["grouping"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.gaugeAndTools.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  return NextResponse.json({
    totalTools,
    currentlyIssued,
    calibrationDue,
    underRepairOrCal,
    groupBreakdown: groupBreakdown.map((g) => ({
      name: g.grouping,
      count: g._count.id,
    })),
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
  });
}
