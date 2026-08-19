import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  COMPANY_UNITS,
  normalizeCompanyUnit,
  scopeKeyToUnit,
  unitStorageVariants,
  type CompanyUnitLabel,
} from "@/lib/companyUnits";

/**
 * Calibration due list.
 * Primary source: TOOLS_TRANS_ISSUE_FOR_CALIBRATION (NXT_CALIB_DATE / CALIB_DUE_DATE / DUE_DATE)
 * because GAUGE_CONTROL_CARD(_TRANS) is often empty in ERP.
 * Secondary: GaugeControlCardTrans when present.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const requestedUnit = normalizeCompanyUnit(req.nextUrl.searchParams.get("unit"));
  let permittedUnits: CompanyUnitLabel[] | null = null;
  const isSystemAdmin =
    session.roleName === "Tools Admin" || session.userId.toLowerCase() === "admin";
  if (!isSystemAdmin && session.userDbId != null) {
    const scopes = await prisma.userUnitScope.findMany({
      where: { userId: session.userDbId },
      select: { unitScope: true },
    });
    if (scopes.length > 0 && !scopes.some((scope) => scope.unitScope === "COMMON")) {
      permittedUnits = scopes
        .map((scope) => scopeKeyToUnit(scope.unitScope))
        .filter((unit): unit is CompanyUnitLabel => Boolean(unit));
    }
  }
  if (requestedUnit && permittedUnits && !permittedUnits.includes(requestedUnit)) {
    return NextResponse.json({ error: "You do not have access to this unit" }, { status: 403 });
  }
  const availableUnits = permittedUnits?.length
    ? permittedUnits
    : COMPANY_UNITS.map((unit) => unit.label);
  const effectiveUnits = requestedUnit
    ? [requestedUnit]
    : [availableUnits[0] ?? "Unit 1"];

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
        description: string | null;
        status: string | null;
        grouping: string | null;
        type: string | null;
        /** Calibration interval from master (CALIBRATION_FRQ_MONTHS) — not due urgency */
        frequency: string | null;
        calibrationFrqMonths: number | null;
        /** ERP Cali. Plan — CALI_PLANNED_WHO */
        caliPlan: string | null;
        /** ERP P.S Min / Max — product spec from master */
        psMin: number | null;
        psMax: number | null;
        cDate: Date | null;
        nextCDate: Date | null;
        remarks: string | null;
        nextCalibrationDate: Date | null;
        serialNo: number | null;
        /** Physical unit status from GAUGE_SERIAL_NO (ERP Cur.Status) */
        unitStatus: string | null;
        location: string | null;
        source: string;
      }
    >();

    const toNum = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const formatFrequency = (months: number | null | undefined): string | null => {
      if (months == null) return null;
      if (months <= 0) return "Not set (0)";
      return `${months} Months`;
    };

    /** Skip calib-DC line statuses like OPEN — those are issue workflow, not tool state. */
    const isToolishStatus = (s: string | null | undefined): boolean => {
      if (!s?.trim()) return false;
      const u = s.trim().toUpperCase();
      if (u === "OPEN" || u === "PARTIAL" || u === "CLOSED" || u === "COMPLETE") return false;
      if (u === "PENDING" || u === "PASS" || u === "FAIL" || u === "CONDITIONAL PASS") return false;
      return true;
    };

    const upsert = (
      toolOrGaugeNo: string,
      row: {
        refNo?: number | null;
        name?: string | null;
        description?: string | null;
        status?: string | null;
        unitStatus?: string | null;
        grouping?: string | null;
        type?: string | null;
        frequency?: string | null;
        calibrationFrqMonths?: number | null;
        caliPlan?: string | null;
        psMin?: number | null;
        psMax?: number | null;
        cDate?: Date | null;
        nextCDate?: Date | null;
        remarks?: string | null;
        serialNo?: number | null;
        location?: string | null;
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
          description: row.description ?? existing?.description ?? null,
          status: row.status ?? existing?.status ?? null,
          unitStatus: row.unitStatus ?? existing?.unitStatus ?? null,
          grouping: row.grouping ?? existing?.grouping ?? null,
          type: row.type ?? existing?.type ?? null,
          frequency: row.frequency ?? existing?.frequency ?? null,
          calibrationFrqMonths:
            row.calibrationFrqMonths ?? existing?.calibrationFrqMonths ?? null,
          caliPlan: row.caliPlan ?? existing?.caliPlan ?? null,
          psMin: row.psMin ?? existing?.psMin ?? null,
          psMax: row.psMax ?? existing?.psMax ?? null,
          cDate: row.cDate ?? existing?.cDate ?? null,
          nextCDate: next,
          remarks: row.remarks ?? existing?.remarks ?? null,
          nextCalibrationDate: next,
          serialNo: row.serialNo ?? existing?.serialNo ?? null,
          location: row.location ?? existing?.location ?? null,
          source: row.source,
        });
      } else if (existing) {
        if (existing.serialNo == null && row.serialNo != null) existing.serialNo = row.serialNo;
        if (!existing.unitStatus && row.unitStatus) existing.unitStatus = row.unitStatus;
        if (!existing.description && row.description) existing.description = row.description;
        if (!existing.caliPlan && row.caliPlan) existing.caliPlan = row.caliPlan;
        if (existing.psMin == null && row.psMin != null) existing.psMin = row.psMin;
        if (existing.psMax == null && row.psMax != null) existing.psMax = row.psMax;
        if (existing.calibrationFrqMonths == null && row.calibrationFrqMonths != null) {
          existing.calibrationFrqMonths = row.calibrationFrqMonths;
          existing.frequency = row.frequency ?? formatFrequency(row.calibrationFrqMonths);
        }
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
            description: true,
            status: true,
            grouping: true,
            type: true,
            location: true,
            calibrationFrqMonths: true,
            caliPlannedWho: true,
            prodSpecLowerMax: true,
            prodSpecUpperMax: true,
          },
        },
      },
    });

    for (const line of lines) {
      const toolNo = line.toolOrGaugeNo ?? line.tool?.toolOrGaugeNo;
      if (!toolNo) continue;
      const next = line.nxtCalibDate ?? line.calibDueDate ?? line.dueDate;
      const masterStatus = line.tool?.status ?? null;
      upsert(toolNo, {
        refNo: line.toolRefNo ?? line.tool?.refNo ?? null,
        name: line.tool?.name ?? null,
        description: line.tool?.description ?? null,
        // Prefer master tool status; never surface calib-DC "Open" as tool status
        status: isToolishStatus(masterStatus) ? masterStatus : null,
        grouping: line.grouping ?? line.tool?.grouping ?? null,
        type: line.tool?.type ?? null,
        calibrationFrqMonths: line.tool?.calibrationFrqMonths ?? null,
        frequency: formatFrequency(line.tool?.calibrationFrqMonths),
        caliPlan: line.tool?.caliPlannedWho ?? null,
        psMin: toNum(line.tool?.prodSpecLowerMax),
        psMax: toNum(line.tool?.prodSpecUpperMax),
        cDate: line.calibratedDate ?? line.creatDt ?? null,
        nextCDate: next,
        remarks: line.calibResultComments ?? line.remarks ?? null,
        serialNo: line.serialNo ?? null,
        location: line.tool?.location ?? null,
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
                  description: true,
                  status: true,
                  grouping: true,
                  type: true,
                  location: true,
                  caliPlannedWho: true,
                  prodSpecLowerMax: true,
                  prodSpecUpperMax: true,
                  calibrationFrqMonths: true,
                },
              },
            },
          },
        },
      });

      for (const t of dueTools) {
        const toolNo = t.controlCard.toolOrGaugeNo;
        const freqRaw = t.controlCard.frequency?.trim() || null;
        const freqLooksZero = !freqRaw || /^0(\s*months?)?$/i.test(freqRaw);
        upsert(toolNo, {
          refNo: t.controlCard.tool?.refNo ?? null,
          name: t.controlCard.tool?.name ?? null,
          description: t.controlCard.tool?.description ?? null,
          status: isToolishStatus(t.controlCard.tool?.status)
            ? t.controlCard.tool?.status ?? null
            : null,
          grouping: t.controlCard.tool?.grouping ?? null,
          type: t.controlCard.type ?? t.controlCard.tool?.type ?? null,
          frequency: freqLooksZero
            ? "Not set (0)"
            : freqRaw ?? formatFrequency(t.controlCard.tool?.calibrationFrqMonths),
          calibrationFrqMonths: t.controlCard.tool?.calibrationFrqMonths ?? null,
          caliPlan: t.controlCard.tool?.caliPlannedWho ?? null,
          psMin: toNum(t.controlCard.tool?.prodSpecLowerMax),
          psMax: toNum(t.controlCard.tool?.prodSpecUpperMax),
          cDate: t.cDate,
          nextCDate: t.nextCDate,
          remarks: t.remarks,
          location: t.controlCard.tool?.location ?? null,
          source: "GAUGE_CONTROL_CARD_TRANS",
        });
      }
    } catch (err) {
      console.warn("GaugeControlCardTrans due lookup skipped:", err);
    }

    // 3) Never-calibrated tools (master has frequency but no due dates yet).
    // Derive next due from earliest unit purchaseDt + frequency when available.
    try {
      const masters = await prisma.gaugeAndTools.findMany({
        where: {
          calibrationFrqMonths: { gt: 0 },
          // SQL NULL status must be allowed — `NOT IN (...)` / Prisma NOT+in drop nulls
          OR: [
            { status: null },
            { status: { notIn: ["Under Calibration", "Scrapped"] } },
          ],
        },
        select: {
          refNo: true,
          toolOrGaugeNo: true,
          name: true,
          description: true,
          status: true,
          grouping: true,
          type: true,
          location: true,
          calibrationFrqMonths: true,
          caliPlannedWho: true,
          prodSpecLowerMax: true,
          prodSpecUpperMax: true,
        },
      });

      const pending = masters.filter(
        (m) => m.toolOrGaugeNo && !byTool.has(m.toolOrGaugeNo)
      );
      const pendingNos = pending
        .map((m) => m.toolOrGaugeNo!)
        .filter(Boolean);

      const serialRows =
        pendingNos.length > 0
          ? await prisma.gaugeSerialNo.findMany({
              where: { toolOrGaugeNo: { in: pendingNos } },
              orderBy: { serialNo: "asc" },
              select: {
                toolOrGaugeNo: true,
                purchaseDt: true,
                serialNo: true,
                status: true,
              },
            })
          : [];

      const serialsByTool = new Map<
        string,
        Array<{ purchaseDt: Date | null; serialNo: number | null; status: string | null }>
      >();
      for (const s of serialRows) {
        if (!s.toolOrGaugeNo) continue;
        const list = serialsByTool.get(s.toolOrGaugeNo) ?? [];
        list.push(s);
        serialsByTool.set(s.toolOrGaugeNo, list);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const m of pending) {
        if (!m.toolOrGaugeNo) continue;
        const serials = serialsByTool.get(m.toolOrGaugeNo) ?? [];
        const purchase = serials.find((s) => s.purchaseDt)?.purchaseDt ?? null;
        let nextDue = today;
        if (purchase && (m.calibrationFrqMonths ?? 0) > 0) {
          const d = new Date(purchase);
          d.setHours(12, 0, 0, 0);
          d.setMonth(d.getMonth() + (m.calibrationFrqMonths ?? 0));
          nextDue = d;
        }

        // Only surface in the alert window (same as line/card sources)
        if (nextDue > alertDate) continue;

        const firstSerial = serials[0];
        upsert(m.toolOrGaugeNo, {
          refNo: m.refNo,
          name: m.name,
          description: m.description,
          status: isToolishStatus(m.status) ? m.status : null,
          unitStatus: firstSerial?.status ?? null,
          grouping: m.grouping,
          type: m.type,
          calibrationFrqMonths: m.calibrationFrqMonths,
          frequency: formatFrequency(m.calibrationFrqMonths),
          caliPlan: m.caliPlannedWho,
          psMin: toNum(m.prodSpecLowerMax),
          psMax: toNum(m.prodSpecUpperMax),
          cDate: purchase,
          nextCDate: nextDue,
          remarks: purchase
            ? "Initial — from purchase date + frequency"
            : "Initial — never calibrated",
          serialNo: firstSerial?.serialNo ?? null,
          location: m.location,
          source: "GAUGEANDTOOLS",
        });
      }
    } catch (err) {
      console.warn("History Card master due lookup skipped:", err);
    }

    // The imported client register is the authoritative calibration schedule.
    // Load every dated instrument, not only the alert-window subset assembled
    // from legacy ERP issue/history tables above.
    type ImportedCalibrationRow = {
      refNo: number;
      toolOrGaugeNo: string | null;
      name: string | null;
      description: string | null;
      status: string | null;
      grouping: string | null;
      type: string | null;
      calibrationFrqMonths: number | null;
      caliPlan: string | null;
      psMin: unknown;
      psMax: unknown;
      location: string | null;
      calibrationDate: Date | null;
      nextCalibrationDue: Date | null;
      remarks: string | null;
    };
    const importedRows = await prisma.$queryRaw<ImportedCalibrationRow[]>`
      SELECT
        g.[REF_NO] AS [refNo],
        g.[TOOL_OR_GAUGE_NO] AS [toolOrGaugeNo],
        g.[NAME] AS [name],
        g.[DES] AS [description],
        g.[STATUS] AS [status],
        g.[GROUPING] AS [grouping],
        g.[TYPE] AS [type],
        g.[CALIBRATION_FRQ_MONTHS] AS [calibrationFrqMonths],
        g.[CALI_PLANNED_WHO] AS [caliPlan],
        g.[PROD_SPEC_LOWER_MAX] AS [psMin],
        g.[PROD_SPEC_UPPER_MAX] AS [psMax],
        g.[LOCATION] AS [location],
        i.[CALIBRATION_DATE] AS [calibrationDate],
        i.[NEXT_CALIBRATION_DUE] AS [nextCalibrationDue],
        g.[REMARKS] AS [remarks]
      FROM [dbo].[GAUGEANDTOOLS] g
      INNER JOIN [dbo].[TOOLS_APP_INSTRUMENT_MASTER_DATA] i
        ON i.[REF_NO] = g.[REF_NO]
      WHERE i.[NEXT_CALIBRATION_DUE] IS NOT NULL
    `;
    for (const row of importedRows) {
      if (!row.toolOrGaugeNo || !row.nextCalibrationDue) continue;
      byTool.set(row.toolOrGaugeNo, {
        refNo: row.refNo,
        toolOrGaugeNo: row.toolOrGaugeNo,
        name: row.name,
        description: row.description,
        status: row.status,
        unitStatus: null,
        grouping: row.grouping,
        type: row.type,
        frequency: formatFrequency(row.calibrationFrqMonths),
        calibrationFrqMonths: row.calibrationFrqMonths,
        caliPlan: row.caliPlan,
        psMin: toNum(row.psMin),
        psMax: toNum(row.psMax),
        cDate: row.calibrationDate,
        nextCDate: row.nextCalibrationDue,
        remarks: row.remarks,
        nextCalibrationDate: row.nextCalibrationDue,
        serialNo: null,
        location: row.location,
        source: "IMPORTED_MASTER_DATA",
      });
    }

    // Tools already issued for calibration must leave the due picker until receive/close.
    const blocked = new Set<string>();
    let underCalibrationCount = 0;
    try {
      // Live STATUS on GAUGEANDTOOLS — used for KPI + exclusion from due picker
      const underCal = await prisma.gaugeAndTools.findMany({
        where: {
          status: { in: ["Under Calibration", "UNDER CALIBRATION"] },
          ...(effectiveUnits?.length
            ? { locationName: { in: effectiveUnits.flatMap(unitStorageVariants) } }
            : {}),
        },
        select: { toolOrGaugeNo: true },
      });
      underCalibrationCount = underCal.length;
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Enrich serial + unit status from GAUGE_SERIAL_NO for Cur.Status
    const allToolNos = Array.from(byTool.keys());
    const unitByTool = new Map<string, CompanyUnitLabel | null>();
    const sizeByTool = new Map<string, string | null>();
    if (allToolNos.length > 0) {
      const masters = await prisma.gaugeAndTools.findMany({
        where: { toolOrGaugeNo: { in: allToolNos } },
        select: { toolOrGaugeNo: true, locationName: true, size: true },
      });
      for (const master of masters) {
        if (master.toolOrGaugeNo) {
          unitByTool.set(master.toolOrGaugeNo, normalizeCompanyUnit(master.locationName));
          sizeByTool.set(master.toolOrGaugeNo, master.size);
        }
      }
      try {
        const serialRows = await prisma.gaugeSerialNo.findMany({
          where: { toolOrGaugeNo: { in: allToolNos } },
          orderBy: { serialNo: "asc" },
          select: { toolOrGaugeNo: true, serialNo: true, status: true },
        });
        // ERP Cur.Status = GAUGE_SERIAL_NO.STATUS for the unit row (lowest Sl.No first)
        const pickByTool = new Map<string, { serialNo: number; status: string | null }>();
        for (const row of serialRows) {
          if (!row.toolOrGaugeNo || row.serialNo == null) continue;
          if (!pickByTool.has(row.toolOrGaugeNo)) {
            pickByTool.set(row.toolOrGaugeNo, {
              serialNo: row.serialNo,
              status: row.status,
            });
          }
        }
        for (const [toolNo, pick] of pickByTool) {
          const entry = byTool.get(toolNo);
          if (!entry) continue;
          if (entry.serialNo == null) entry.serialNo = pick.serialNo;
          if (pick.status) entry.unitStatus = pick.status;
        }
      } catch (err) {
        console.warn("GaugeSerialNo enrichment skipped:", err);
      }
    }

    // ERP lists all due tools in the alert window — do not hard-cap at 200
    // (that was dropping newer masters like OTH_J00331 behind older overdue rows).
    const items = Array.from(byTool.values())
      .filter((i) => i.nextCalibrationDate != null)
      .filter((i) => !blocked.has(i.toolOrGaugeNo))
      .filter((i) => {
        if (!effectiveUnits?.length) return true;
        const unit = unitByTool.get(i.toolOrGaugeNo);
        return unit != null && effectiveUnits.includes(unit);
      })
      .map((i) => ({
        ...i,
        unit: unitByTool.get(i.toolOrGaugeNo) ?? null,
        size: sizeByTool.get(i.toolOrGaugeNo) ?? null,
        // One master row is one tracked instrument; master status is authoritative.
        status: i.status || i.unitStatus || "—",
        curStatus: i.status || i.unitStatus || "—",
        description: i.description || i.name || null,
        caliPlan: i.caliPlan && i.caliPlan !== "N/A" ? i.caliPlan : null,
        psMin: i.psMin,
        psMax: i.psMax ?? 0,
        frequency: i.frequency || formatFrequency(i.calibrationFrqMonths) || "Not set",
      }))
      .sort(
        (a, b) =>
          (a.nextCalibrationDate?.getTime() ?? 0) - (b.nextCalibrationDate?.getTime() ?? 0)
      );

    // KPI splits (mutually exclusive within the alert-window due list):
    // dueSoon  = nextCalibrationDate >= start of today (upcoming window, not overdue)
    // overdue  = nextCalibrationDate <  start of today (past due, not yet issued/closed)
    const dueSoonCount = items.filter(
      (i) => i.nextCalibrationDate != null && i.nextCalibrationDate >= startOfToday && i.nextCalibrationDate <= alertDate
    ).length;
    const overdueCount = items.filter(
      (i) => i.nextCalibrationDate != null && i.nextCalibrationDate < startOfToday
    ).length;

    return NextResponse.json({
      items,
      total: items.length,
      alertDays,
      dueSoonCount,
      overdueCount,
      underCalibrationCount,
      activeUnit: effectiveUnits[0],
      availableUnits,
    });
  } catch (error) {
    console.error("Error fetching calibration due list:", error);
    return NextResponse.json(
      {
        items: [],
        alertDays,
        dueSoonCount: 0,
        overdueCount: 0,
        underCalibrationCount: 0,
        error: "Failed to load calibration due list",
      },
      { status: 500 }
    );
  }
}
