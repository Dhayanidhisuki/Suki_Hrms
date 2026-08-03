import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/**
 * Calibration due list.
 * Primary source: TOOLS_TRANS_ISSUE_FOR_CALIBRATION (NXT_CALIB_DATE / CALIB_DUE_DATE / DUE_DATE)
 * because GAUGE_CONTROL_CARD(_TRANS) is often empty in ERP.
 * Secondary: GaugeControlCardTrans when present.
 */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const alertDays = Number(process.env.CALIBRATION_ALERT_DAYS ?? 90);
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + alertDays);

  try {
    const byTool = new Map<
      string,
      {
        refNo: number | null;
        toolOrGaugeNo: string;
        name: string | null;
        status: string | null;
        grouping: string | null;
        type: string | null;
        frequency: string | null;
        cDate: Date | null;
        nextCDate: Date | null;
        remarks: string | null;
        nextCalibrationDate: Date | null;
        source: string;
      }
    >();

    const upsert = (
      toolOrGaugeNo: string,
      row: {
        refNo?: number | null;
        name?: string | null;
        status?: string | null;
        grouping?: string | null;
        type?: string | null;
        frequency?: string | null;
        cDate?: Date | null;
        nextCDate?: Date | null;
        remarks?: string | null;
        source: string;
      }
    ) => {
      if (!toolOrGaugeNo) return;
      const next = row.nextCDate ?? null;
      const existing = byTool.get(toolOrGaugeNo);
      if (
        !existing ||
        (next && existing.nextCalibrationDate && next < existing.nextCalibrationDate) ||
        (next && !existing.nextCalibrationDate)
      ) {
        byTool.set(toolOrGaugeNo, {
          refNo: row.refNo ?? existing?.refNo ?? null,
          toolOrGaugeNo,
          name: row.name ?? existing?.name ?? null,
          status: row.status ?? existing?.status ?? null,
          grouping: row.grouping ?? existing?.grouping ?? null,
          type: row.type ?? existing?.type ?? null,
          frequency: row.frequency ?? existing?.frequency ?? null,
          cDate: row.cDate ?? existing?.cDate ?? null,
          nextCDate: next,
          remarks: row.remarks ?? existing?.remarks ?? null,
          nextCalibrationDate: next,
          source: row.source,
        });
      }
    };

    // 1) Line-level dates from calibration issue transactions
    const lines = await prisma.toolsTransIssueForCalibration.findMany({
      where: {
        OR: [
          { nxtCalibDate: { lte: alertDate } },
          { calibDueDate: { lte: alertDate } },
          { dueDate: { lte: alertDate } },
        ],
      },
      orderBy: [{ nxtCalibDate: "asc" }, { calibDueDate: "asc" }, { dueDate: "asc" }],
      take: 500,
      include: {
        tool: {
          select: {
            refNo: true,
            toolOrGaugeNo: true,
            name: true,
            status: true,
            grouping: true,
            type: true,
            calibrationFrqMonths: true,
          },
        },
      },
    });

    for (const line of lines) {
      const toolNo = line.toolOrGaugeNo ?? line.tool?.toolOrGaugeNo;
      if (!toolNo) continue;
      const next = line.nxtCalibDate ?? line.calibDueDate ?? line.dueDate;
      upsert(toolNo, {
        refNo: line.toolRefNo ?? line.tool?.refNo ?? null,
        name: line.tool?.name ?? null,
        status: line.resultStatus ?? line.calibrationStatus ?? line.status ?? line.tool?.status ?? null,
        grouping: line.grouping ?? line.tool?.grouping ?? null,
        type: line.tool?.type ?? null,
        frequency: line.tool?.calibrationFrqMonths != null ? `${line.tool.calibrationFrqMonths} Months` : null,
        cDate: line.calibratedDate ?? line.creatDt ?? null,
        nextCDate: next,
        remarks: line.calibResultComments ?? line.remarks ?? null,
        source: "TOOLS_TRANS_ISSUE_FOR_CALIBRATION",
      });
    }

    // 2) Control-card history when available (optional enrichment)
    try {
      const dueTools = await prisma.gaugeControlCardTrans.findMany({
        where: { nextCDate: { lte: alertDate } },
        orderBy: { nextCDate: "asc" },
        take: 200,
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
                  type: true,
                },
              },
            },
          },
        },
      });

      for (const t of dueTools) {
        const toolNo = t.controlCard.toolOrGaugeNo;
        upsert(toolNo, {
          refNo: t.controlCard.tool?.refNo ?? null,
          name: t.controlCard.tool?.name ?? null,
          status: t.controlCard.tool?.status ?? t.controlCard.status ?? null,
          grouping: t.controlCard.tool?.grouping ?? null,
          type: t.controlCard.type ?? t.controlCard.tool?.type ?? null,
          frequency: t.controlCard.frequency ?? null,
          cDate: t.cDate,
          nextCDate: t.nextCDate,
          remarks: t.remarks,
          source: "GAUGE_CONTROL_CARD_TRANS",
        });
      }
    } catch (err) {
      console.warn("GaugeControlCardTrans due lookup skipped:", err);
    }

    // 3) Never-calibrated History Card tools (master has freq but no due dates yet)
    try {
      const masters = await prisma.gaugeAndTools.findMany({
        where: {
          historyCardReq: { in: ["Yes", "Y", "YES"] },
          calibrationFrqMonths: { gt: 0 },
          NOT: { status: { in: ["Under Calibration", "Scrapped"] } },
        },
        select: {
          refNo: true,
          toolOrGaugeNo: true,
          name: true,
          status: true,
          grouping: true,
          type: true,
          calibrationFrqMonths: true,
        },
        take: 200,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const m of masters) {
        if (!m.toolOrGaugeNo || byTool.has(m.toolOrGaugeNo)) continue;
        upsert(m.toolOrGaugeNo, {
          refNo: m.refNo,
          name: m.name,
          status: m.status,
          grouping: m.grouping,
          type: m.type,
          frequency:
            m.calibrationFrqMonths != null ? `${m.calibrationFrqMonths} Months` : null,
          cDate: null,
          nextCDate: today,
          remarks: "Initial — never calibrated",
          source: "GAUGEANDTOOLS",
        });
      }
    } catch (err) {
      console.warn("History Card master due lookup skipped:", err);
    }

    // Tools already issued for calibration must leave the due picker until receive/close.
    const blocked = new Set<string>();
    try {
      const underCal = await prisma.gaugeAndTools.findMany({
        where: { status: { in: ["Under Calibration", "UNDER CALIBRATION"] } },
        select: { toolOrGaugeNo: true },
      });
      for (const t of underCal) {
        if (t.toolOrGaugeNo) blocked.add(t.toolOrGaugeNo);
      }

      // Active app/ERP issue lines: Issued + Pending, not yet result-posted
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
    } catch (err) {
      console.warn("Open calibration issue exclusion skipped:", err);
    }

    const items = Array.from(byTool.values())
      .filter((i) => i.nextCalibrationDate != null)
      .filter((i) => !blocked.has(i.toolOrGaugeNo))
      .sort(
        (a, b) =>
          (a.nextCalibrationDate?.getTime() ?? 0) - (b.nextCalibrationDate?.getTime() ?? 0)
      )
      .slice(0, 200);

    return NextResponse.json({ items, total: items.length, alertDays });
  } catch (error) {
    console.error("Error fetching calibration due list:", error);
    return NextResponse.json(
      { items: [], alertDays, error: "Failed to load calibration due list" },
      { status: 500 }
    );
  }
}
