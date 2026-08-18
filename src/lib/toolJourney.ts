import { prisma } from "@/lib/prisma";
import { buildToolUnitHistory } from "@/lib/toolUnitHistory";
import {
  loadCalibResultsClosed,
  loadCalibResultsPending,
} from "@/lib/calibResultsData";

/** Unified timeline event types (filter chips on History Card). */
export type JourneyEventType =
  | "purchase"
  | "grn"
  | "issue"
  | "receive"
  | "calibration"
  | "defect"
  | "service"
  | "deviation"
  | "document"
  | "status";

export type ToolJourneyEvent = {
  type: JourneyEventType;
  /** ISO date (prefer YYYY-MM-DD for display sorting) */
  date: string;
  title: string;
  subtitle: string;
  meta: Record<string, string | number | null | undefined>;
  sourceId: string;
  /** Physical unit serial when known */
  serialNo?: string | null;
};

export type ToolJourneyResponse = {
  toolOrGaugeNo: string;
  refNo: number;
  name: string | null;
  events: ToolJourneyEvent[];
  serials: string[];
  counts: Record<JourneyEventType, number>;
};

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function sortKey(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ERP tool codes often carry trailing " G", tabs, or spaces — expand match keys. */
export function toolCodeVariants(raw: string): string[] {
  const cleaned = raw.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
  const base = cleaned.replace(/\s+G$/i, "").trim();
  return [...new Set([raw, raw.trim(), cleaned, base].filter((s) => s.length > 0))];
}

const toolSelect = {
  refNo: true,
  toolOrGaugeNo: true,
  name: true,
  calibrationFrqMonths: true,
  status: true,
  creatDt: true,
} as const;

async function resolveTool(toolOrGaugeNo: string, refNo?: number | null) {
  if (refNo != null && Number.isFinite(refNo) && refNo > 0) {
    const byRef = await prisma.gaugeAndTools.findUnique({
      where: { refNo },
      select: toolSelect,
    });
    if (byRef) return byRef;
  }

  for (const code of toolCodeVariants(toolOrGaugeNo)) {
    const exact = await prisma.gaugeAndTools.findUnique({
      where: { toolOrGaugeNo: code },
      select: toolSelect,
    });
    if (exact) return exact;
  }

  const needle = toolOrGaugeNo.trim();
  if (needle.length < 3) return null;
  return prisma.gaugeAndTools.findFirst({
    where: { toolOrGaugeNo: { contains: needle } },
    select: toolSelect,
  });
}

function itemCodeWhere(variants: string[], refNo: number) {
  const base = variants[variants.length - 1] ?? "";
  return {
    OR: [
      { toolRefNo: refNo },
      ...variants.map((itemCode) => ({ itemCode })),
      ...(base.length >= 5 ? [{ itemCode: { contains: base } }] : []),
    ],
  };
}

function toolNoWhere(variants: string[], refNo: number) {
  return {
    OR: [
      { toolRefNo: refNo },
      ...variants.map((toolOrGaugeNo) => ({ toolOrGaugeNo })),
    ],
  };
}

/**
 * Load a merged chronological journey for one tool by reusing the same
 * Prisma sources as History Card Status / Issue / Receive / Calib / GRN / PO.
 */
export async function loadToolJourney(
  toolOrGaugeNo: string,
  opts?: { refNo?: number | null }
): Promise<ToolJourneyResponse | null> {
  const tool = await resolveTool(toolOrGaugeNo, opts?.refNo);
  if (!tool) return null;

  const rawNo = (tool.toolOrGaugeNo ?? toolOrGaugeNo).trim() || toolOrGaugeNo;
  const variants = toolCodeVariants(rawNo);
  const codesForLines = [...new Set([...variants, toolOrGaugeNo.trim()])];

  const [
    units,
    issueLines,
    receiveLines,
    calibIssueLines,
    calibReceiveLines,
    calibPending,
    calibClosed,
    controlHistory,
    defects,
    services,
    deviations,
    documents,
    grnLines,
    poLines,
    schLines,
  ] = await Promise.all([
    buildToolUnitHistory({
      refNo: tool.refNo,
      toolOrGaugeNo: tool.toolOrGaugeNo,
      calibrationFrqMonths: tool.calibrationFrqMonths,
    }),
    prisma.toolsTransIssue.findMany({
      where: toolNoWhere(codesForLines, tool.refNo),
      orderBy: { creatDt: "desc" },
      take: 200,
      include: {
        header: {
          select: {
            dcNo: true,
            receiveName: true,
            subCode: true,
            custCode: true,
            issueDate: true,
            dueDate: true,
            status: true,
            issueOption: true,
            poOrderNo: true,
            fromUnit: true,
          },
        },
      },
    }),
    prisma.toolsIssueReceivedTrans.findMany({
      where: toolNoWhere(codesForLines, tool.refNo),
      orderBy: { creatDt: "desc" },
      take: 200,
      include: {
        header: {
          select: {
            recNo: true,
            dcNo: true,
            receiveDate: true,
            contName: true,
            subCode: true,
            status: true,
            location: true,
            poOrderNo: true,
          },
        },
      },
    }),
    prisma.toolsTransIssueForCalibration.findMany({
      where: toolNoWhere(codesForLines, tool.refNo),
      orderBy: { creatDt: "desc" },
      take: 200,
      include: {
        calibIssue: {
          select: {
            dcNo: true,
            receiveName: true,
            issueDate: true,
            issueFor: true,
            toolsPoNo: true,
          },
        },
      },
    }),
    prisma.toolsTransReceiveForCalibration.findMany({
      where: { OR: codesForLines.map((toolOrGaugeNo) => ({ toolOrGaugeNo })) },
      orderBy: { creatDt: "desc" },
      take: 200,
      include: {
        header: {
          select: {
            recNo: true,
            dcNo: true,
            receiveDate: true,
            partyDcNo: true,
            vendorCd: true,
            receiverName: true,
            status: true,
          },
        },
      },
    }),
    loadCalibResultsPending(500),
    loadCalibResultsClosed(500),
    prisma.gaugeControlCardTrans.findMany({
      where: {
        controlCard: {
          OR: codesForLines.map((code) => ({ toolOrGaugeNo: code })),
        },
      },
      orderBy: { cDate: "desc" },
      take: 100,
    }),
    prisma.instrumentDefect.findMany({
      where: { refNo: tool.refNo },
      orderBy: { reportedDate: "desc" },
      take: 200,
    }),
    prisma.instrumentServiceRecord.findMany({
      where: { refNo: tool.refNo },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.calibrationDeviation.findMany({
      where: { toolOrGaugeNo: { in: codesForLines } },
      orderBy: { recordedAt: "desc" },
      take: 200,
    }),
    prisma.toolDocument.findMany({
      where: { toolOrGaugeNo: { in: codesForLines }, deletedAt: null },
      orderBy: { creatDt: "desc" },
      take: 200,
    }),
    // GET /api/po/grn source — itemCode variants + toolRefNo
    prisma.toolsPoReceiveTrans.findMany({
      where: itemCodeWhere(codesForLines, tool.refNo),
      orderBy: { creatDt: "desc" },
      take: 150,
      include: {
        grn: {
          select: {
            girNo: true,
            girNoNew: true,
            girDate: true,
            girStatus: true,
            poOrderNo: true,
            supCode: true,
            supplier: { select: { supName: true } },
          },
        },
      },
    }),
    // GET /api/po source
    prisma.commonPurchaseItem.findMany({
      where: itemCodeWhere(codesForLines, tool.refNo),
      orderBy: { creatDt: "desc" },
      take: 150,
      include: {
        order: {
          select: {
            poOrderNo: true,
            poDate: true,
            supCode: true,
            orderStatusCd: true,
            supplier: { select: { supName: true } },
          },
        },
      },
    }),
    // Tools PO schedule — poTransNo = tool REF_NO (see /api/po/schedule)
    prisma.toolsPoSchTrans.findMany({
      where: { poTransNo: tool.refNo },
      orderBy: { creatDt: "desc" },
      take: 100,
      include: {
        schedule: {
          select: {
            rowId: true,
            poOrderNo: true,
            schDate: true,
            status: true,
            remarks: true,
          },
        },
      },
    }),
  ]);

  const events: ToolJourneyEvent[] = [];
  const seenPoNos = new Set<string>();

  for (const line of poLines) {
    const po = line.order;
    const poNo = (po?.poOrderNo || line.poOrderNo || "").trim();
    if (poNo) seenPoNos.add(poNo);
    const date =
      toIsoDate(po?.poDate) || toIsoDate(line.creatDt) || new Date(0).toISOString();
    const vendor = po?.supplier?.supName || po?.supCode || "—";
    events.push({
      type: "purchase",
      date,
      title: `PO ${poNo || "—"}`,
      subtitle: `Vendor ${vendor} · Qty ${num(line.qty) ?? "—"}`,
      meta: {
        poOrderNo: poNo || null,
        vendor,
        qty: num(line.qty),
        price: num(line.price),
        uom: line.uom,
        itemCode: line.itemCode,
        itemName: line.itemName,
        orderStatusCd: po?.orderStatusCd,
      },
      sourceId: `po-${line.rowId}`,
    });
  }

  for (const line of schLines) {
    const sch = line.schedule;
    const poNo = (sch?.poOrderNo || "").trim();
    if (poNo) seenPoNos.add(poNo);
    const date =
      toIsoDate(sch?.schDate) || toIsoDate(line.creatDt) || new Date(0).toISOString();
    events.push({
      type: "purchase",
      date,
      title: poNo ? `PO schedule ${poNo}` : "PO schedule line",
      subtitle: `Qty ${num(line.qty) ?? "—"} · ${line.schStatus || sch?.status || "Scheduled"}`,
      meta: {
        poOrderNo: poNo || null,
        qty: num(line.qty),
        schStatus: line.schStatus,
        scheduleStatus: sch?.status,
        remarks: line.comments || sch?.remarks,
        scheduleRowId: sch?.rowId,
      },
      sourceId: `po-sch-${line.rowId}`,
    });
  }

  for (const u of units) {
    if (!u.purchaseDt) continue;
    events.push({
      type: "purchase",
      date: toIsoDate(u.purchaseDt) || u.purchaseDt,
      title: "Unit purchased / registered",
      subtitle: u.make ? `Make ${u.make}` : `Serial ${u.serialNo}`,
      meta: {
        serialNo: u.serialNo,
        make: u.make,
        purchaseDt: u.purchaseDt,
      },
      sourceId: `unit-purchase-${u.refNo}`,
      serialNo: u.serialNo,
    });
  }

  for (const line of grnLines) {
    const hdr = line.grn;
    const date =
      toIsoDate(hdr?.girDate) || toIsoDate(line.creatDt) || new Date(0).toISOString();
    const girLabel = hdr?.girNoNew || (hdr?.girNo != null ? `GIR-${hdr.girNo}` : "GRN");
    const poNo = (hdr?.poOrderNo || "").trim();
    events.push({
      type: "grn",
      date,
      title: `GRN ${girLabel}`,
      subtitle: poNo
        ? `Against PO ${poNo} · Qty ${num(line.recQty) ?? "—"}`
        : `Qty received ${num(line.recQty) ?? "—"}`,
      meta: {
        girNo: hdr?.girNo ?? line.girNo,
        girNoNew: hdr?.girNoNew,
        girStatus: hdr?.girStatus,
        poOrderNo: poNo || null,
        vendor: hdr?.supplier?.supName || hdr?.supCode,
        itemCode: line.itemCode,
        invQty: num(line.invQty),
        recQty: num(line.recQty),
        price: num(line.price),
      },
      sourceId: `grn-${line.rowId}`,
    });
  }

  const missingPoNos = [
    ...new Set(
      grnLines
        .map((l) => (l.grn?.poOrderNo || "").trim())
        .filter((n) => n && !seenPoNos.has(n))
    ),
  ];
  if (missingPoNos.length > 0) {
    const orphanPos = await prisma.commonPurchaseOrder.findMany({
      where: { poOrderNo: { in: missingPoNos } },
      select: {
        poOrderNo: true,
        poDate: true,
        supCode: true,
        supplier: { select: { supName: true } },
      },
    });
    for (const po of orphanPos) {
      seenPoNos.add(po.poOrderNo);
      events.push({
        type: "purchase",
        date: toIsoDate(po.poDate) || new Date(0).toISOString(),
        title: `PO ${po.poOrderNo}`,
        subtitle: `Vendor ${po.supplier?.supName || po.supCode || "—"} · via GRN`,
        meta: {
          poOrderNo: po.poOrderNo,
          vendor: po.supplier?.supName || po.supCode,
          source: "Linked from GRN",
        },
        sourceId: `po-from-grn-${po.poOrderNo}`,
      });
    }
    for (const poNo of missingPoNos) {
      if (seenPoNos.has(poNo)) continue;
      const sample = grnLines.find((l) => (l.grn?.poOrderNo || "").trim() === poNo);
      events.push({
        type: "purchase",
        date:
          toIsoDate(sample?.grn?.girDate) ||
          toIsoDate(sample?.creatDt) ||
          new Date(0).toISOString(),
        title: `PO ${poNo}`,
        subtitle: "Referenced on GRN (PO header not in COMMON_PURCHASE_ORDER)",
        meta: { poOrderNo: poNo, source: "GRN reference" },
        sourceId: `po-ref-${poNo}`,
      });
      seenPoNos.add(poNo);
    }
  }

  for (const line of issueLines) {
    const h = line.header;
    const date =
      toIsoDate(h?.issueDate) || toIsoDate(line.creatDt) || new Date(0).toISOString();
    const holder =
      h?.receiveName || h?.subCode || h?.custCode || line.issueEmpName || "—";
    events.push({
      type: "issue",
      date,
      title: `Issued on DC ${h?.dcNo || line.dcNo}`,
      subtitle: `To ${holder}`,
      meta: {
        dcNo: h?.dcNo || line.dcNo,
        issueTo: holder,
        subCode: h?.subCode,
        qty: num(line.issueQty),
        status: h?.status || line.status,
        dueDate: toIsoDate(h?.dueDate)?.slice(0, 10),
        issueOption: h?.issueOption,
        fromUnit: h?.fromUnit,
        destination: line.issueToItemNo,
        poOrderNo: h?.poOrderNo,
        machine: line.machine,
        serialNo: line.serialNo,
      },
      sourceId: `issue-${line.rowId}`,
      serialNo: line.serialNo != null ? String(line.serialNo) : null,
    });
  }

  for (const line of receiveLines) {
    const h = line.header;
    const date =
      toIsoDate(h?.receiveDate) || toIsoDate(line.creatDt) || new Date(0).toISOString();
    const from = h?.contName || h?.subCode || "—";
    events.push({
      type: "receive",
      date,
      title: `Received · Rec ${h?.recNo ?? "—"}`,
      subtitle: `From ${from}${h?.dcNo ? ` · DC ${h.dcNo}` : ""}`,
      meta: {
        recNo: h?.recNo,
        dcNo: h?.dcNo,
        receivedFrom: from,
        qty: num(line.quantity),
        condition: line.status,
        comments: line.comments,
        location: h?.location,
        poOrderNo: h?.poOrderNo,
        serialNo: line.serialNo,
      },
      sourceId: `receive-${line.rowId}`,
      serialNo: line.serialNo != null ? String(line.serialNo) : null,
    });
  }

  const calibResultKeys = new Set<string>();
  const toolNoSet = new Set(codesForLines.map((c) => c.toUpperCase()));
  for (const row of [...calibClosed, ...calibPending]) {
    if (!toolNoSet.has((row.toolOrGaugeNo || "").toUpperCase().trim())) continue;
    const key = `calib-result-${row.refNo}`;
    if (calibResultKeys.has(key)) continue;
    calibResultKeys.add(key);
    const date =
      toIsoDate(row.cDate as string | Date | null) ||
      toIsoDate(row.calibDueDate as string | Date | null) ||
      new Date(0).toISOString();
    events.push({
      type: "calibration",
      date,
      title: row.dcNo != null ? `Calib DC ${row.dcNo}` : "Calibration result",
      subtitle: `${row.status}${row.nextCDate ? ` · Next ${String(row.nextCDate).slice(0, 10)}` : ""}`,
      meta: {
        dcNo: row.dcNo,
        result: row.status,
        nextDue: row.nextCDate ? String(row.nextCDate).slice(0, 10) : null,
        calibratedBy: row.calibratedBy,
        issueFor: row.issueFor,
        remarks: row.remarks,
        serialNo: row.serialNo,
      },
      sourceId: key,
      serialNo: row.serialNo != null ? String(row.serialNo) : null,
    });
  }

  for (const line of calibIssueLines) {
    const key = `calib-issue-${line.rowId}`;
    if (calibResultKeys.has(`calib-result-${line.rowId}`)) continue;
    const h = line.calibIssue;
    const date =
      toIsoDate(line.calibratedDate) ||
      toIsoDate(h?.issueDate) ||
      toIsoDate(line.creatDt) ||
      new Date(0).toISOString();
    events.push({
      type: "calibration",
      date,
      title: h?.dcNo != null ? `Calib issue DC ${h.dcNo}` : "Calibration issue",
      subtitle: [
        line.resultStatus || line.calibrationStatus || line.status || "Issued",
        h?.issueFor ? `· ${h.issueFor}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      meta: {
        dcNo: h?.dcNo ?? line.dcNo,
        result: line.resultStatus,
        calibrationStatus: line.calibrationStatus,
        nextDue: toIsoDate(line.nxtCalibDate || line.calibDueDate)?.slice(0, 10),
        receiveName: h?.receiveName,
        toolsPoNo: h?.toolsPoNo,
        serialNo: line.serialNo,
      },
      sourceId: key,
      serialNo: line.serialNo != null ? String(line.serialNo) : null,
    });
  }

  for (const line of calibReceiveLines) {
    const h = line.header;
    events.push({
      type: "calibration",
      date:
        toIsoDate(h?.receiveDate) ||
        toIsoDate(line.creatDt) ||
        new Date(0).toISOString(),
      title: `Received from calibration · Rec ${h?.recNo ?? line.recNo}`,
      subtitle: `DC ${h?.dcNo ?? line.dcNo} · ${h?.status || "Received"}`,
      meta: {
        recNo: h?.recNo ?? line.recNo,
        dcNo: h?.dcNo ?? line.dcNo,
        partyDcNo: h?.partyDcNo,
        vendor: h?.vendorCd,
        receiverName: h?.receiverName,
        qty: num(line.qty),
        serialNo: line.serialNo,
      },
      sourceId: `calib-receive-${line.rowId}`,
      serialNo: line.serialNo != null ? String(line.serialNo) : null,
    });
  }

  for (const row of controlHistory) {
    const date =
      toIsoDate(row.cDate) || toIsoDate(row.creatDt) || new Date(0).toISOString();
    const nextDue = toIsoDate(row.nextCDate)?.slice(0, 10);
    events.push({
      type: "calibration",
      date,
      title: "Control card calibration",
      subtitle: nextDue
        ? `Next due ${nextDue}`
        : row.remarks || "Control card entry",
      meta: {
        cDate: toIsoDate(row.cDate)?.slice(0, 10),
        nextCDate: nextDue,
        remarks: row.remarks,
      },
      sourceId: `control-${row.rowId}`,
    });
  }

  for (const row of defects) {
    events.push({
      type: "defect",
      date: toIsoDate(row.reportedDate) || toIsoDate(row.createdAt) || new Date(0).toISOString(),
      title: `Defect · ${row.status}`,
      subtitle: row.defectDetails,
      meta: {
        defectId: row.id,
        unitCode: row.unitCode,
        errorDeviation: row.errorDeviation,
        reportedBy: row.reportedBy,
      },
      sourceId: `defect-${row.id}`,
    });
  }

  for (const row of services) {
    events.push({
      type: "service",
      date:
        toIsoDate(row.receivedDate) ||
        toIsoDate(row.sentDate) ||
        toIsoDate(row.createdAt) ||
        new Date(0).toISOString(),
      title: `Service · ${row.finalStatus || row.status}`,
      subtitle: row.serviceAgency || "Internal service",
      meta: {
        serviceId: row.id,
        defectId: row.defectId,
        sentDate: toIsoDate(row.sentDate)?.slice(0, 10),
        receivedDate: toIsoDate(row.receivedDate)?.slice(0, 10),
        repairDetails: row.repairDetails,
        verificationResult: row.verificationResult,
        cost: num(row.cost),
      },
      sourceId: `service-${row.id}`,
    });
  }

  for (const row of deviations) {
    events.push({
      type: "deviation",
      date: toIsoDate(row.recordedAt) || new Date(0).toISOString(),
      title: `${row.parameter} · ${row.resultStatus}`,
      subtitle: row.deviation,
      meta: {
        deviationId: row.id,
        correctiveAction: row.correctiveAction,
        resultStatus: row.resultStatus,
      },
      sourceId: `deviation-${row.id}`,
    });
  }

  for (const row of documents) {
    events.push({
      type: "document",
      date: toIsoDate(row.creatDt) || new Date(0).toISOString(),
      title: row.docType,
      subtitle: row.originalName,
      meta: {
        documentId: row.id,
        fileName: row.originalName,
        documentType: row.docType,
      },
      sourceId: `document-${row.id}`,
    });
  }

  for (const u of units) {
    const date =
      toIsoDate(u.lastCaliDt) ||
      toIsoDate(u.dcDate) ||
      toIsoDate(u.purchaseDt) ||
      toIsoDate(tool.creatDt) ||
      new Date(0).toISOString();
    events.push({
      type: "status",
      date,
      title: u.status || "Unit status",
      subtitle: u.dcNo
        ? `Held by ${u.issueTo || "—"} · DC ${u.dcNo}`
        : "In store / crib",
      meta: {
        serialNo: u.serialNo,
        status: u.status,
        issueTo: u.issueTo,
        dcNo: u.dcNo,
        dcDate: u.dcDate,
        nextCaliDt: u.nextCaliDt,
        nextPreMntDt: u.nextPreMntDt,
      },
      sourceId: `status-unit-${u.refNo}`,
      serialNo: u.serialNo,
    });
  }

  if (tool.status) {
    events.push({
      type: "status",
      date: toIsoDate(tool.creatDt) || new Date().toISOString(),
      title: `Master status · ${tool.status}`,
      subtitle: "GAUGEANDTOOLS.STATUS",
      meta: { status: tool.status },
      sourceId: `status-master-${tool.refNo}`,
    });
  }

  events.sort((a, b) => sortKey(b.date) - sortKey(a.date));

  const serials = [
    ...new Set(
      units
        .map((u) => u.serialNo?.trim())
        .filter((s): s is string => Boolean(s) && s !== "—")
    ),
  ].sort();

  const counts: Record<JourneyEventType, number> = {
    purchase: 0,
    grn: 0,
    issue: 0,
    receive: 0,
    calibration: 0,
    defect: 0,
    service: 0,
    deviation: 0,
    document: 0,
    status: 0,
  };
  for (const e of events) counts[e.type] += 1;

  return {
    toolOrGaugeNo: rawNo,
    refNo: tool.refNo,
    name: tool.name,
    events,
    serials,
    counts,
  };
}
