import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { resolveUnitScope, unitIsAllowed, type ResolvedUnitScope } from "@/lib/unitScope";

/** Unique tools in the calibration alert window (+ due this week). */
async function getCalibrationDueStats(now: Date, unitScope: ResolvedUnitScope) {
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
    if (!unitScope.unrestricted) {
      const toolNos = [...byTool.keys()];
      const tools = toolNos.length
        ? await prisma.gaugeAndTools.findMany({
            where: { toolOrGaugeNo: { in: toolNos } },
            select: { toolOrGaugeNo: true, locationName: true },
          })
        : [];
      const allowedTools = new Set(
        tools.filter((tool) => unitIsAllowed(unitScope, tool.locationName)).map((tool) => tool.toolOrGaugeNo)
      );
      for (const toolNo of toolNos) {
        if (!allowedTools.has(toolNo)) byTool.delete(toolNo);
      }
    }
  } catch (err) {
    console.warn("KPI unit scope filter skipped:", err);
  }

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
  const unitScope = await resolveUnitScope(session);

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
      allIssues,
      allReceives,
      calibDue,
    ] = await Promise.all([
      prisma.gaugeAndTools.count(),
      // Tools with qty out on shop floor (exclude under-calibration masters)
      // Count unique tools currently out on active (open) issue DCs.
      // qtyOut is not reliably maintained in this dataset, so we derive
      // the count from open transaction lines instead.
      prisma.toolsTransIssue
        .findMany({
          where: {
            header: { status: { in: ["Active", "ACTIVE", "OPEN", "open"] } },
          },
          select: { toolOrGaugeNo: true },
        })
        .then((lines) => new Set(lines.map((l) => l.toolOrGaugeNo).filter(Boolean)).size)
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
      prisma.toolsTransIssue.findMany({
        select: {
          creatDt: true,
          header: { select: { issueDate: true, creatDt: true, fromUnit: true } },
        },
      }),
      prisma.toolsIssueReceivedTrans.findMany({
        select: {
          creatDt: true,
          header: {
            select: {
              receiveDate: true,
              creatDt: true,
              issueHeader: { select: { fromUnit: true } },
            },
          },
        },
      }),
      getCalibrationDueStats(now, unitScope),
    ]);

    // If database returned data, process and return real data
    if (totalTools > 0) {
      // A movement is a transaction line (one tracked instrument), never a
      // newly imported master row. Keep the chart comparison generic so the
      // UI can group the same records by month or week.
      const canonicalUnit = (value: string | null | undefined) => {
        const compact = (value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
        if (compact === "unit1") return "Unit 1";
        if (compact === "unit2") return "Unit 2";
        if (compact === "unit3") return "Unit 3";
        return "Unassigned";
      };
      const issueEvents = allIssues
        .map((line) => ({
          date: line.header.issueDate ?? line.header.creatDt ?? line.creatDt,
          unit: canonicalUnit(line.header.fromUnit),
        }))
        .filter((event): event is { date: Date; unit: string } => event.date instanceof Date);
      const receiveEvents = allReceives
        .map((line) => ({
          date: line.header.receiveDate ?? line.header.creatDt ?? line.creatDt,
          unit: canonicalUnit(line.header.issueHeader.fromUnit),
        }))
        .filter((event): event is { date: Date; unit: string } => event.date instanceof Date);
      const issueDates = issueEvents.map((event) => event.date);
      const receiveDates = receiveEvents.map((event) => event.date);
      const movementDates = [...issueDates, ...receiveDates];

      const countBetween = (start: Date, end: Date) =>
        movementDates.filter((value) => value >= start && value < end).length;
      const countDatesBetween = (dates: Date[], start: Date, end: Date) =>
        dates.filter((value) => value >= start && value < end).length;
      const unitBreakdown = (start: Date, end: Date) =>
        Object.fromEntries(
          ["Unit 1", "Unit 2", "Unit 3", "Unassigned"].map((unit) => [
            unit,
            {
              issued: issueEvents.filter(
                (event) => event.unit === unit && event.date >= start && event.date < end
              ).length,
              received: receiveEvents.filter(
                (event) => event.unit === unit && event.date >= start && event.date < end
              ).length,
            },
          ])
        );

      const countInMonth = (year: number, monthIdx: number) => {
        const start = new Date(year, monthIdx, 1);
        const end = new Date(year, monthIdx + 1, 1);
        return countBetween(start, end);
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
        const start = new Date(m.year, m.monthIdx, 1);
        const end = new Date(m.year, m.monthIdx + 1, 1);
        const issued = countDatesBetween(issueDates, start, end);
        const received = countDatesBetween(receiveDates, start, end);

        return {
          month: m.month,
          year: m.year,
          Issued: issued,
          Received: received,
          thisPeriod: issued,
          previousPeriod: received,
          byUnit: unitBreakdown(start, end),
          totalMovements: current,
        };
      });

      const currentWeekStart = new Date(now);
      const mondayOffset = (currentWeekStart.getDay() + 6) % 7;
      currentWeekStart.setDate(currentWeekStart.getDate() - mondayOffset);
      currentWeekStart.setHours(0, 0, 0, 0);

      const weeklyTrends = Array.from({ length: 12 }, (_, index) => {
        const weeksBack = 11 - index;
        const start = new Date(currentWeekStart);
        start.setDate(start.getDate() - weeksBack * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        const displayEnd = new Date(end);
        displayEnd.setDate(displayEnd.getDate() - 1);

        return {
          month: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
          year: start.getFullYear(),
          labelDate: `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${displayEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
          thisPeriod: countDatesBetween(issueDates, start, end),
          previousPeriod: countDatesBetween(receiveDates, start, end),
          byUnit: unitBreakdown(start, end),
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
        weeklyTrends,
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
