import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** Unique tools in the calibration alert window (+ due this week). */
async function getCalibrationDueStats(now: Date) {
  const alertDays = Number(process.env.CALIBRATION_ALERT_DAYS ?? 90);
  const alertDate = new Date(now);
  alertDate.setDate(alertDate.getDate() + alertDays);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const byTool = new Map<string, Date>();

  const upsert = (toolNo: string | null | undefined, next: Date | null | undefined) => {
    if (!toolNo || !next) return;
    const existing = byTool.get(toolNo);
    if (!existing || next < existing) byTool.set(toolNo, next);
  };

  try {
    const lines = await prisma.toolsTransIssueForCalibration.findMany({
      where: {
        OR: [
          { nxtCalibDate: { lte: alertDate } },
          { calibDueDate: { lte: alertDate } },
          { dueDate: { lte: alertDate } },
        ],
      },
      select: {
        toolOrGaugeNo: true,
        nxtCalibDate: true,
        calibDueDate: true,
        dueDate: true,
      },
      take: 500,
    });
    for (const line of lines) {
      upsert(
        line.toolOrGaugeNo,
        line.nxtCalibDate ?? line.calibDueDate ?? line.dueDate
      );
    }
  } catch (err) {
    console.warn("KPI calib due lines lookup skipped:", err);
  }

  try {
    const cardRows = await prisma.gaugeControlCardTrans.findMany({
      where: { nextCDate: { lte: alertDate } },
      orderBy: { nextCDate: "asc" },
      take: 200,
      include: { controlCard: { select: { toolOrGaugeNo: true } } },
    });
    for (const row of cardRows) {
      upsert(row.controlCard.toolOrGaugeNo, row.nextCDate);
    }
  } catch (err) {
    console.warn("KPI calib due control-card lookup skipped:", err);
  }

  // Exclude tools already under calibration / open issue lines
  try {
    const blocked = new Set<string>();
    const underCal = await prisma.gaugeAndTools.findMany({
      where: { status: { in: ["Under Calibration", "UNDER CALIBRATION"] } },
      select: { toolOrGaugeNo: true },
    });
    for (const t of underCal) {
      if (t.toolOrGaugeNo) blocked.add(t.toolOrGaugeNo);
    }
    const activeLines = await prisma.toolsTransIssueForCalibration.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: { in: ["Issued", "ISSUED"] } },
              { calibrationStatus: { in: ["Pending", "PENDING", "pending"] } },
            ],
          },
          {
            OR: [
              { resultStatus: null },
              { resultStatus: "" },
              { resultStatus: "PENDING" },
            ],
          },
        ],
      },
      select: { toolOrGaugeNo: true },
    });
    for (const line of activeLines) {
      if (line.toolOrGaugeNo) blocked.add(line.toolOrGaugeNo);
    }
    for (const toolNo of blocked) byTool.delete(toolNo);
  } catch (err) {
    console.warn("KPI calib due exclusion skipped:", err);
  }

  let calibrationThisWeek = 0;
  for (const next of byTool.values()) {
    if (next.getTime() <= weekEnd.getTime()) calibrationThisWeek += 1;
  }

  return {
    calibrationDue: byTool.size,
    calibrationThisWeek,
  };
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    /** Master statuses that mean the tool is in the calibration pipeline (not shop-floor issued). */
    const underCalStatuses = [
      "Under Calibration",
      "UNDER CALIBRATION",
      "ISSUE FOR CALIBRATION",
    ];

    const [
      totalTools,
      currentlyIssued,
      underRepairOrCal,
      groupBreakdown,
      statusBreakdown,
      addedThisMonth,
      overdueCount,
      recentActivity,
      allTools,
      allIssues,
      allReceives,
      calibDue,
    ] = await Promise.all([
      prisma.gaugeAndTools.count(),
      // Tools with qty out on shop floor (exclude under-calibration masters)
      prisma.gaugeAndTools
        .count({
          where: {
            qtyOut: { gt: 0 },
            NOT: { status: { in: underCalStatuses } },
          },
        })
        .catch(() => 0),
      // Tools currently under calibration / issued for calib (master status)
      prisma.gaugeAndTools
        .count({
          where: { status: { in: underCalStatuses } },
        })
        .catch(() => 0),
      prisma.gaugeAndTools.groupBy({
        by: ["grouping"],
        _count: { refNo: true },
        orderBy: { _count: { refNo: "desc" } },
      }),
      prisma.gaugeAndTools.groupBy({
        by: ["status"],
        _count: { refNo: true },
      }),
      prisma.gaugeAndTools.count({
        where: { creatDt: { gte: startOfMonth } },
      }),
      // Overdue = Active/OPEN issue DCs past their due date
      prisma.gaugeToolsIssue.count({
        where: {
          status: { in: ["Active", "OPEN"] },
          dueDate: { lt: now },
        },
      }),
      prisma.gaugeToolsIssue.findMany({
        orderBy: { creatDt: "desc" },
        take: 5,
        select: {
          dcNo: true,
          receiveName: true,
          issueDate: true,
          dueDate: true,
          status: true,
        },
      }),
      prisma.gaugeAndTools.findMany({ select: { creatDt: true } }),
      prisma.gaugeToolsIssue.findMany({ select: { issueDate: true, creatDt: true } }),
      prisma.toolsIssueReceived.findMany({ select: { receiveDate: true, creatDt: true } }),
      getCalibrationDueStats(now),
    ]);

    // If database returned data, process and return real data
    if (totalTools > 0) {
      const countInMonth = (
        year: number,
        monthIdx: number
      ): { added: number; issued: number; received: number; total: number } => {
        const added = allTools.filter((t) => {
          const cd = new Date(t.creatDt ?? Date.now());
          return cd.getFullYear() === year && cd.getMonth() === monthIdx;
        }).length;

        const issued = allIssues.filter((i) => {
          const id = new Date(i.issueDate || i.creatDt || Date.now());
          return id.getFullYear() === year && id.getMonth() === monthIdx;
        }).length;

        const received = allReceives.filter((r) => {
          const rd = new Date(r.receiveDate || r.creatDt || Date.now());
          return rd.getFullYear() === year && rd.getMonth() === monthIdx;
        }).length;

        return { added, issued, received, total: added + issued + received };
      };

      const months: Array<{ month: string; year: number; monthIdx: number }> = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toLocaleString("default", { month: "short" }),
          year: d.getFullYear(),
          monthIdx: d.getMonth(),
        });
      }

      const monthlyTrends = months.map((m) => {
        const current = countInMonth(m.year, m.monthIdx);
        const previous = countInMonth(m.year - 1, m.monthIdx);

        return {
          month: m.month,
          year: m.year,
          Added: current.added,
          Issued: current.issued,
          Received: current.received,
          thisPeriod: current.total,
          previousPeriod: previous.total,
        };
      });

      // Clamp so Progress rings never overshoot the register size
      const issuedClamped = Math.min(currentlyIssued, totalTools);
      const underCalClamped = Math.min(
        underRepairOrCal,
        Math.max(0, totalTools - issuedClamped)
      );

      return NextResponse.json({
        totalTools,
        currentlyIssued: issuedClamped,
        calibrationDue: calibDue.calibrationDue,
        underRepairOrCal: underCalClamped,
        trends: {
          addedThisMonth,
          overdueCount,
          calibrationThisWeek: calibDue.calibrationThisWeek,
        },
        groupBreakdown: (() => {
          const merged = new Map<string, number>();
          for (const g of groupBreakdown) {
            const name = (g.grouping || "General").trim() || "General";
            merged.set(name, (merged.get(name) ?? 0) + g._count.refNo);
          }
          return Array.from(merged, ([name, count]) => ({ name, count }));
        })(),
        statusBreakdown: (() => {
          const merged = new Map<string, number>();
          for (const s of statusBreakdown) {
            const status = (s.status || "Available").trim() || "Available";
            merged.set(status, (merged.get(status) ?? 0) + s._count.refNo);
          }
          return Array.from(merged, ([status, count]) => ({ status, count }));
        })(),
        monthlyTrends,
        recentActivity: recentActivity.map((a) => ({
          id: a.dcNo,
          dcNo: a.dcNo,
          receiveName: a.receiveName,
          partyName: a.receiveName,
          deptName: a.receiveName,
          issueDate: a.issueDate?.toISOString() ?? null,
          dueDate: a.dueDate?.toISOString() ?? null,
          status: a.status ?? "OPEN",
        })),
      });
    }
  } catch (error) {
    console.error("Dashboard KPI Database query error:", error);
  }

  // Fallback Dataset when DB is offline or empty
  return NextResponse.json({
    totalTools: 48,
    currentlyIssued: 12,
    calibrationDue: 14,
    underRepairOrCal: 4,
    trends: {
      addedThisMonth: 6,
      overdueCount: 2,
      calibrationThisWeek: 3,
    },
    groupBreakdown: [
      { name: "Measuring Equipment", count: 22 },
      { name: "Cutting Tools", count: 14 },
      { name: "Jigs & Fixtures", count: 8 },
      { name: "Special Gauges", count: 4 },
    ],
    statusBreakdown: [
      { status: "Available", count: 32 },
      { status: "Issued", count: 12 },
      { status: "Under Calibration", count: 3 },
      { status: "Under Repair", count: 1 },
    ],
    monthlyTrends: [
      { month: "Sep", year: 2025, Added: 3, Issued: 9, Received: 8, thisPeriod: 20, previousPeriod: 16 },
      { month: "Oct", year: 2025, Added: 4, Issued: 11, Received: 9, thisPeriod: 24, previousPeriod: 18 },
      { month: "Nov", year: 2025, Added: 5, Issued: 10, Received: 10, thisPeriod: 25, previousPeriod: 21 },
      { month: "Dec", year: 2025, Added: 6, Issued: 13, Received: 11, thisPeriod: 30, previousPeriod: 22 },
      { month: "Jan", year: 2026, Added: 4, Issued: 8, Received: 7, thisPeriod: 19, previousPeriod: 15 },
      { month: "Feb", year: 2026, Added: 5, Issued: 10, Received: 9, thisPeriod: 24, previousPeriod: 17 },
      { month: "Mar", year: 2026, Added: 3, Issued: 12, Received: 11, thisPeriod: 26, previousPeriod: 20 },
      { month: "Apr", year: 2026, Added: 8, Issued: 15, Received: 13, thisPeriod: 36, previousPeriod: 28 },
      { month: "May", year: 2026, Added: 6, Issued: 14, Received: 12, thisPeriod: 32, previousPeriod: 25 },
      { month: "Jun", year: 2026, Added: 7, Issued: 16, Received: 14, thisPeriod: 37, previousPeriod: 27 },
      { month: "Jul", year: 2026, Added: 6, Issued: 12, Received: 10, thisPeriod: 28, previousPeriod: 23 },
      { month: "Aug", year: 2026, Added: 5, Issued: 11, Received: 9, thisPeriod: 25, previousPeriod: 19 },
    ],
    recentActivity: [
      {
        id: "DC-2026-089",
        dcNo: "DC-2026-089",
        receiveName: "Suresh Patel",
        partyName: "Suresh Patel",
        deptName: "Suresh Patel",
        issueDate: "2026-07-27T09:00:00.000Z",
        dueDate: "2026-07-30T17:00:00.000Z",
        status: "OPEN",
      },
      {
        id: "DC-2026-088",
        dcNo: "DC-2026-088",
        receiveName: "Ramesh Kumar",
        partyName: "Ramesh Kumar",
        deptName: "Ramesh Kumar",
        issueDate: "2026-07-26T10:30:00.000Z",
        dueDate: "2026-07-28T17:00:00.000Z",
        status: "CLOSED",
      },
      {
        id: "DC-2026-087",
        dcNo: "DC-2026-087",
        receiveName: "Priya Sharma",
        partyName: "Priya Sharma",
        deptName: "Priya Sharma",
        issueDate: "2026-07-25T14:15:00.000Z",
        dueDate: "2026-07-29T17:00:00.000Z",
        status: "OPEN",
      },
    ],
  });
}
