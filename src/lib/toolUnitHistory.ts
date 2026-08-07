import { prisma } from "@/lib/prisma";

export type ToolUnitHistoryRow = {
  key: string;
  refNo: number;
  serialNo: string;
  status: string;
  make: string;
  /** GAUGE_SERIAL_NO.C_DATE */
  purchaseDt: string | null;
  /**
   * ERP "Purchase At" — no dedicated column on GAUGE_SERIAL_NO in pulled schema.
   * Reserved for future mapping; always null today.
   */
  purchaseAt: string | null;
  lastCaliDt: string | null;
  nextCaliDt: string | null;
  lastPreMntDt: string | null;
  nextPreMntDt: string | null;
  /** From TOOLS_TRANS_ISSUE_FOR_CALIBRATION.PREVENTIVE_DONE */
  lastPreMntDone: string | null;
  /** GAUGE_SERIAL_NO.NXT_PRE_DONE */
  nextPreMntDone: string | null;
  /** GAUGE_SERIAL_NO.CURRENT_STATUS */
  preMntPresentStatus: string | null;
  issueTo: string | null;
  dcNo: string | null;
  dcDate: string | null;
};

type CalibDates = { last: Date | null; next: Date | null };

function fmtDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function ynFlag(value: number | null | undefined): string | null {
  if (value == null) return null;
  return value === 1 ? "Yes" : "No";
}

function presentStatus(value: number | null | undefined): string | null {
  if (value == null) return null;
  // ERP stores a small int status code — surface the code until a lookup exists.
  return String(value);
}

/** Prefer the candidate that actually has a calibrated / next date. */
function mergeCalibDates(a?: CalibDates | null, b?: CalibDates | null): CalibDates | undefined {
  if (!a && !b) return undefined;
  if (!a) return b ?? undefined;
  if (!b) return a;
  return {
    last: a.last ?? b.last ?? null,
    next: a.next ?? b.next ?? null,
  };
}

/**
 * Score for picking the “latest meaningful” calib line.
 * Prefer completed calibrations (CALIBRATED_DATE) over open issue stubs.
 */
function calibLineScore(line: {
  calibratedDate: Date | null;
  nxtCalibDate: Date | null;
  calibDueDate: Date | null;
  dueDate: Date | null;
  creatDt: Date | null;
}): number {
  const last = line.calibratedDate?.getTime() ?? 0;
  const next =
    line.nxtCalibDate?.getTime() ??
    line.calibDueDate?.getTime() ??
    line.dueDate?.getTime() ??
    0;
  const created = line.creatDt?.getTime() ?? 0;
  // Weight completed calibrations heavily so open ISSUE lines don't win.
  return (line.calibratedDate ? 1e15 : 0) + last * 10 + next + created;
}

function lineToCalibDates(line: {
  calibratedDate: Date | null;
  nxtCalibDate: Date | null;
  calibDueDate: Date | null;
  dueDate: Date | null;
}): CalibDates {
  return {
    last: line.calibratedDate ?? null,
    next: line.nxtCalibDate ?? line.calibDueDate ?? line.dueDate ?? null,
  };
}

/**
 * Build ERP-style unit rows for one tool from GAUGE_SERIAL_NO,
 * enriched with latest calib line dates, control-card history, PM flags, and open issue holder/DC.
 */
export async function buildToolUnitHistory(tool: {
  refNo: number;
  toolOrGaugeNo: string | null;
  calibrationFrqMonths?: number | null;
}): Promise<ToolUnitHistoryRow[]> {
  const toolNo = tool.toolOrGaugeNo;

  let calibFrq = tool.calibrationFrqMonths;
  if (calibFrq === undefined && tool.refNo) {
    try {
      const master = await prisma.gaugeAndTools.findUnique({
        where: { refNo: tool.refNo },
        select: { calibrationFrqMonths: true },
      });
      calibFrq = master?.calibrationFrqMonths;
    } catch {
      // non-critical
    }
  }

  const serials = await prisma.gaugeSerialNo.findMany({
    where: {
      OR: [
        ...(toolNo ? [{ toolOrGaugeNo: toolNo }] : []),
        { toolRefNo: tool.refNo },
      ],
    },
    orderBy: [{ serialNo: "asc" }, { refNo: "asc" }],
  });

  if (serials.length === 0) return [];

  const serialNos = serials.map((s) => s.serialNo).filter((n): n is number => n != null);

  const calibLines = await prisma.toolsTransIssueForCalibration.findMany({
    where: {
      OR: [
        ...(toolNo ? [{ toolOrGaugeNo: toolNo }] : []),
        { toolRefNo: tool.refNo },
      ],
    },
    orderBy: [{ creatDt: "desc" }],
    take: 200,
  });

  // Tool-level control card history (written by Results Update even when no open issue line).
  let cardDates: CalibDates | undefined;
  if (toolNo) {
    const cardKey = toolNo.slice(0, 15);
    const card = await prisma.gaugeControlCard.findFirst({
      where: {
        OR: [{ toolOrGaugeNo: toolNo }, { toolOrGaugeNo: cardKey }],
      },
      include: {
        history: {
          orderBy: [{ cDate: "desc" }, { creatDt: "desc" }],
          take: 1,
        },
      },
    });
    const hist = card?.history?.[0];
    if (hist?.cDate || hist?.nextCDate) {
      cardDates = { last: hist.cDate ?? null, next: hist.nextCDate ?? null };
    }
  }

  const preventiveBySerial = new Map<
    number,
    { lastPre: Date | null; nextPre: Date | null; lastDone: number | null }
  >();
  const prevRows = toolNo
    ? await prisma.$queryRaw<
        Array<{
          SERIAL_NO: number | null;
          PREVENTIVE_DATE: Date | null;
          NXT_PREVENTIVE_DATE: Date | null;
          PREVENTIVE_DONE: number | null;
        }>
      >`
        SELECT TOP 200 SERIAL_NO, PREVENTIVE_DATE, NXT_PREVENTIVE_DATE, PREVENTIVE_DONE
        FROM TOOLS_TRANS_ISSUE_FOR_CALIBRATION
        WHERE TOOL_OR_GAUGE_NO = ${toolNo} OR TOOL_REF_NO = ${tool.refNo}
        ORDER BY COALESCE(CALIBRATED_DATE, CREAT_DT) DESC
      `
    : await prisma.$queryRaw<
        Array<{
          SERIAL_NO: number | null;
          PREVENTIVE_DATE: Date | null;
          NXT_PREVENTIVE_DATE: Date | null;
          PREVENTIVE_DONE: number | null;
        }>
      >`
        SELECT TOP 200 SERIAL_NO, PREVENTIVE_DATE, NXT_PREVENTIVE_DATE, PREVENTIVE_DONE
        FROM TOOLS_TRANS_ISSUE_FOR_CALIBRATION
        WHERE TOOL_REF_NO = ${tool.refNo}
        ORDER BY COALESCE(CALIBRATED_DATE, CREAT_DT) DESC
      `;
  for (const row of prevRows) {
    if (row.SERIAL_NO == null) continue;
    if (preventiveBySerial.has(row.SERIAL_NO)) continue;
    preventiveBySerial.set(row.SERIAL_NO, {
      lastPre: row.PREVENTIVE_DATE,
      nextPre: row.NXT_PREVENTIVE_DATE,
      lastDone: row.PREVENTIVE_DONE,
    });
  }

  const issueLines = await prisma.toolsTransIssue.findMany({
    where: {
      OR: [
        ...(toolNo ? [{ toolOrGaugeNo: toolNo }] : []),
        { toolRefNo: tool.refNo },
        ...(serialNos.length ? [{ serialNo: { in: serialNos } }] : []),
      ],
    },
    include: {
      header: { select: { dcNo: true, subCode: true, issueDate: true, status: true } },
    },
    orderBy: { creatDt: "desc" },
    take: 300,
  });

  const receivedDc = new Set(
    (
      await prisma.toolsIssueReceived.findMany({
        where: { dcNo: { in: [...new Set(issueLines.map((l) => l.dcNo))] } },
        select: { dcNo: true },
      })
    ).map((r) => r.dcNo)
  );

  const openBySerial = new Map<
    number | "any",
    { issueTo: string | null; dcNo: string; dcDate: string | null }
  >();
  for (const line of issueLines) {
    if (receivedDc.has(line.dcNo)) continue;
    const payload = {
      issueTo: line.issueEmpName || line.header?.subCode || line.partNo || null,
      dcNo: line.dcNo,
      dcDate: fmtDate(line.header?.issueDate),
    };
    if (line.serialNo != null && !openBySerial.has(line.serialNo)) {
      openBySerial.set(line.serialNo, payload);
    }
    if (!openBySerial.has("any")) openBySerial.set("any", payload);
  }

  // Open calibration issue → unit STATUS should be ISSUE FOR CALIBRATION
  const openCalibBySerial = new Map<number | "any", true>();
  for (const line of calibLines) {
    const st = String(line.status ?? "").toUpperCase();
    const calibSt = String(line.calibrationStatus ?? "").toUpperCase();
    const resultSt = String(line.resultStatus ?? "").trim();
    const isOpen =
      !resultSt &&
      (st.includes("ISSUE FOR CALIBRATION") ||
        st === "ISSUED" ||
        st === "OPEN" ||
        st === "UNDER CALIBRATION" ||
        st === "RECEIVED" ||
        calibSt === "PENDING" ||
        calibSt === "OPEN");
    if (!isOpen) continue;
    if (line.serialNo != null) openCalibBySerial.set(line.serialNo, true);
    openCalibBySerial.set("any", true);
  }

  // Best calib dates per serial + tool-level ("any"). Prefer completed calibrations.
  const latestCalibBySerial = new Map<number | "any", CalibDates>();
  const bestScoreByKey = new Map<number | "any", number>();

  const consider = (key: number | "any", line: (typeof calibLines)[number]) => {
    const score = calibLineScore(line);
    const prev = bestScoreByKey.get(key) ?? -1;
    if (score <= prev) return;
    bestScoreByKey.set(key, score);
    latestCalibBySerial.set(key, lineToCalibDates(line));
  };

  for (const line of calibLines) {
    if (line.serialNo != null) consider(line.serialNo, line);
    consider("any", line);
  }

  return serials.map((s) => {
    const sn = s.serialNo;
    const serialCalib = sn != null ? latestCalibBySerial.get(sn) : undefined;
    const anyCalib = latestCalibBySerial.get("any");
    // Serial-specific open stubs (null CALIBRATED_DATE) must not hide tool-level completed results.
    const calib = mergeCalibDates(mergeCalibDates(serialCalib, anyCalib), cardDates);

    // If never calibrated but frequency is set, derive nextCaliDt from purchaseDt + freq months
    let derivedNextCaliDt: string | null = null;
    if (!calib?.next && (calibFrq ?? 0) > 0) {
      const base = s.purchaseDt ? new Date(s.purchaseDt) : s.creatDt ? new Date(s.creatDt) : new Date();
      if (!isNaN(base.getTime())) {
        const derived = new Date(base);
        derived.setMonth(derived.getMonth() + (calibFrq ?? 1));
        derivedNextCaliDt = fmtDate(derived);
      }
    }

    const prev = (sn != null ? preventiveBySerial.get(sn) : undefined) ?? null;
    const open =
      (sn != null ? openBySerial.get(sn) : undefined) ??
      (String(s.status ?? "").toUpperCase().includes("ISSUE")
        ? openBySerial.get("any")
        : undefined);

    const hasSerialSpecificCalib = [...openCalibBySerial.keys()].some(
      (k) => typeof k === "number"
    );
    const hasOpenCalib =
      sn != null
        ? openCalibBySerial.has(sn) ||
          (!hasSerialSpecificCalib && openCalibBySerial.has("any"))
        : openCalibBySerial.has("any");
    let displayStatus = s.status || "—";
    if (hasOpenCalib) {
      const u = displayStatus.toUpperCase();
      if (
        !u.includes("ISSUE FOR CALIBRATION") &&
        u !== "REJECTED" &&
        u !== "WORN OUT" &&
        u !== "BROKEN"
      ) {
        displayStatus = "ISSUE FOR CALIBRATION";
      }
    } else if (open && displayStatus) {
      const u = displayStatus.toUpperCase();
      if (u === "AVAILABLE FOR USE" || u === "AVAILABLE" || u === "NEW PURCHASE") {
        displayStatus = "VENDOR USE";
      }
    }

    return {
      key: String(s.refNo),
      refNo: s.refNo,
      serialNo: sn != null ? String(sn) : "—",
      status: displayStatus,
      make: (s.make ?? "").trim() || "—",
      purchaseDt: fmtDate(s.purchaseDt),
      purchaseAt: null,
      lastCaliDt: fmtDate(calib?.last),
      nextCaliDt: fmtDate(calib?.next) ?? derivedNextCaliDt,
      lastPreMntDt: fmtDate(prev?.lastPre),
      nextPreMntDt: fmtDate(prev?.nextPre ?? s.nextPreDate),
      lastPreMntDone: ynFlag(prev?.lastDone),
      nextPreMntDone: ynFlag(s.nextPreDone),
      preMntPresentStatus: presentStatus(s.currentStatus),
      issueTo: open?.issueTo ?? null,
      dcNo: open?.dcNo ?? null,
      dcDate: open?.dcDate ?? null,
    };
  });
}
