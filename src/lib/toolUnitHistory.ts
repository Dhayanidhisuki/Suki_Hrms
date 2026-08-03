import { prisma } from "@/lib/prisma";

export type ToolUnitHistoryRow = {
  key: string;
  refNo: number;
  serialNo: string;
  status: string;
  make: string;
  purchaseDt: string | null;
  lastCaliDt: string | null;
  nextCaliDt: string | null;
  lastPreMntDt: string | null;
  nextPreMntDt: string | null;
  issueTo: string | null;
  dcNo: string | null;
  dcDate: string | null;
};

function fmtDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

/**
 * Build legacy-style unit grid rows for one tool from GAUGE_SERIAL_NO,
 * enriched with latest calib line dates and open issue holder/DC.
 */
export async function buildToolUnitHistory(tool: {
  refNo: number;
  toolOrGaugeNo: string | null;
}): Promise<ToolUnitHistoryRow[]> {
  const toolNo = tool.toolOrGaugeNo;

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
    orderBy: [{ calibratedDate: "desc" }, { creatDt: "desc" }],
    take: 200,
  });

  // Preventive dates not fully mapped on the Prisma model — pull via raw for matching rows.
  const preventiveBySerial = new Map<
    number,
    { lastPre: Date | null; nextPre: Date | null }
  >();
  const prevRows = toolNo
    ? await prisma.$queryRaw<
        Array<{
          SERIAL_NO: number | null;
          PREVENTIVE_DATE: Date | null;
          NXT_PREVENTIVE_DATE: Date | null;
        }>
      >`
        SELECT TOP 200 SERIAL_NO, PREVENTIVE_DATE, NXT_PREVENTIVE_DATE
        FROM TOOLS_TRANS_ISSUE_FOR_CALIBRATION
        WHERE TOOL_OR_GAUGE_NO = ${toolNo} OR TOOL_REF_NO = ${tool.refNo}
        ORDER BY COALESCE(CALIBRATED_DATE, CREAT_DT) DESC
      `
    : await prisma.$queryRaw<
        Array<{
          SERIAL_NO: number | null;
          PREVENTIVE_DATE: Date | null;
          NXT_PREVENTIVE_DATE: Date | null;
        }>
      >`
        SELECT TOP 200 SERIAL_NO, PREVENTIVE_DATE, NXT_PREVENTIVE_DATE
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

  const latestCalibBySerial = new Map<
    number | "any",
    { last: Date | null; next: Date | null }
  >();
  for (const line of calibLines) {
    const last = line.calibratedDate ?? null;
    const next = line.nxtCalibDate ?? line.calibDueDate ?? line.dueDate ?? null;
    if (line.serialNo != null && !latestCalibBySerial.has(line.serialNo)) {
      latestCalibBySerial.set(line.serialNo, { last, next });
    }
    if (!latestCalibBySerial.has("any")) {
      latestCalibBySerial.set("any", { last, next });
    }
  }

  return serials.map((s) => {
    const sn = s.serialNo;
    const calib =
      (sn != null ? latestCalibBySerial.get(sn) : undefined) ??
      latestCalibBySerial.get("any");
    const prev =
      (sn != null ? preventiveBySerial.get(sn) : undefined) ?? null;
    const open =
      (sn != null ? openBySerial.get(sn) : undefined) ??
      (String(s.status ?? "").toUpperCase().includes("ISSUE")
        ? openBySerial.get("any")
        : undefined);

    return {
      key: String(s.refNo),
      refNo: s.refNo,
      serialNo: sn != null ? String(sn) : "—",
      status: s.status || "—",
      make: (s.make ?? "").trim() || "—",
      purchaseDt: fmtDate(s.purchaseDt),
      lastCaliDt: fmtDate(calib?.last),
      nextCaliDt: fmtDate(calib?.next ?? s.nextPreDate),
      lastPreMntDt: fmtDate(prev?.lastPre),
      nextPreMntDt: fmtDate(prev?.nextPre ?? s.nextPreDate),
      issueTo: open?.issueTo ?? null,
      dcNo: open?.dcNo ?? null,
      dcDate: open?.dcDate ?? null,
    };
  });
}
