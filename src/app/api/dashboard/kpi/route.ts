import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const now = new Date();
  const alertDays = Number(process.env.CALIBRATION_ALERT_DAYS ?? 30);
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + alertDays);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const [
    totalTools,
    currentlyIssued,
    calibrationDue,
    underRepairOrCal,
    groupBreakdown,
    statusBreakdown,
    addedThisMonth,
    overdueCount,
    calibrationThisWeek,
    recentCalibrationDue,
    recentActivity,
    allTools,
    allIssues,
    allReceives,
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
    prisma.gaugeAndTools.count({
      where: { creatDt: { gte: startOfMonth } },
    }),
    prisma.gaugeToolsIssue.count({
      where: {
        status: "OPEN",
        dueDate: { lt: now },
      },
    }),
    prisma.gaugeAndTools.count({
      where: {
        nextCalibrationDate: {
          gte: now,
          lte: weekFromNow,
        },
      },
    }),
    prisma.gaugeAndTools.findMany({
      where: { nextCalibrationDate: { not: null } },
      orderBy: { nextCalibrationDate: "asc" },
      take: 5,
      select: {
        id: true,
        toolOrGaugeNo: true,
        name: true,
        nextCalibrationDate: true,
        status: true,
        grouping: true,
      },
    }),
    prisma.gaugeToolsIssue.findMany({
      orderBy: { creatDt: "desc" },
      take: 5,
      select: {
        id: true,
        dcNo: true,
        deptName: true,
        partyName: true,
        issueDate: true,
        dueDate: true,
        status: true,
      },
    }),
    prisma.gaugeAndTools.findMany({
      select: { creatDt: true },
    }),
    prisma.gaugeToolsIssue.findMany({
      select: { issueDate: true, creatDt: true },
    }),
    prisma.toolsIssueReceived.findMany({
      select: { receiveDate: true, creatDt: true },
    }),
  ]);

  // Compute 6-month monthly trends and cumulative growth
  const months: Array<{ month: string; year: number; monthIdx: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleString("default", { month: "short" });
    months.push({
      month: monthLabel,
      year: d.getFullYear(),
      monthIdx: d.getMonth(),
    });
  }

  let runningTotal = 0;
  const monthlyTrends = months.map((m) => {
    const added = allTools.filter((t) => {
      const cd = new Date(t.creatDt);
      return cd.getFullYear() === m.year && cd.getMonth() === m.monthIdx;
    }).length;

    const issued = allIssues.filter((i) => {
      const id = new Date(i.issueDate || i.creatDt);
      return id.getFullYear() === m.year && id.getMonth() === m.monthIdx;
    }).length;

    const received = allReceives.filter((r) => {
      const rd = new Date(r.receiveDate || r.creatDt);
      return rd.getFullYear() === m.year && rd.getMonth() === m.monthIdx;
    }).length;

    return {
      month: m.month,
      Added: added,
      Issued: issued,
      Received: received,
    };
  });

  const cumulativeGrowth = months.map((m) => {
    const endOfM = new Date(m.year, m.monthIdx + 1, 0, 23, 59, 59);
    const countTillEnd = allTools.filter((t) => new Date(t.creatDt) <= endOfM).length;
    return {
      month: m.month,
      Cumulative: countTillEnd,
    };
  });

  return NextResponse.json({
    totalTools,
    currentlyIssued,
    calibrationDue,
    underRepairOrCal,
    trends: {
      addedThisMonth,
      overdueCount,
      calibrationThisWeek,
    },
    groupBreakdown: groupBreakdown.map((g) => ({
      name: g.grouping,
      count: g._count.id,
    })),
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    monthlyTrends,
    cumulativeGrowth,
    recentCalibrationDue: recentCalibrationDue.map((c) => ({
      ...c,
      nextCalibrationDate: c.nextCalibrationDate?.toISOString() ?? null,
    })),
    recentActivity: recentActivity.map((a) => ({
      ...a,
      issueDate: a.issueDate?.toISOString() ?? null,
      dueDate: a.dueDate?.toISOString() ?? null,
    })),
  });
}
