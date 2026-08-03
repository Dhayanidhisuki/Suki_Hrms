import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { GaugeAndToolsCreateSchema } from "@/lib/validators";
import { computeToolRollupStatus, rollupStatusWhere } from "@/lib/toolStatusRollup";
import {
  erpCreateDefaults,
  normalizeLocationAndLookups,
  stripPlaceholder,
} from "@/lib/toolCreate";
import { computeNextPreDate, isAssetYes } from "@/lib/preventiveFlow";

function normalizeSerialFlag(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? "Y" : "N";
  const text = String(value).trim().toUpperCase();
  if (text === "YES" || text === "Y") return "Y";
  if (text === "NO" || text === "N") return "N";
  return String(value).slice(0, 5);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const grouping = searchParams.get("grouping") ?? "";
  const status = searchParams.get("status") ?? "";
  /** When "1", only return tools with qtyIn > 0 (Tool Issue picker). */
  const availableOnly = searchParams.get("availableOnly") === "1";
  /** When "1", only tools with HISTORY_CARD_REQ = Yes (History Card module). */
  const historyCardOnly = searchParams.get("historyCardOnly") === "1";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 20));
  const skip = (page - 1) * pageSize;

  // Status filters on the roll-up computed from GAUGE_SERIAL_NO unit rows,
  // never on GAUGEANDTOOLS.STATUS (verified to carry no lifecycle signal).
  const statusWhere = status ? rollupStatusWhere(status) : null;

  const where = {
    AND: [
      search
        ? {
            OR: [
              { toolOrGaugeNo: { contains: search } },
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {},
      grouping ? { grouping: { contains: grouping } } : {},
      statusWhere ?? {},
      availableOnly ? { qtyIn: { gt: 0 } } : {},
      historyCardOnly ? { historyCardReq: "Yes" } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.gaugeAndTools.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { creatDt: "desc" },
      include: {
        serialNumbers: true,
        machineMapping: { select: { macCode: true } },
      },
    }),
    prisma.gaugeAndTools.count({ where }),
  ]);

  const items = rows.map(({ machineMapping, ...tool }) => ({
    ...tool,
    computedStatus: computeToolRollupStatus(
      tool.serialNumbers.map((s) => s.status),
      tool.activeItem
    ),
    machines: machineMapping
      .map((m) => m.macCode)
      .filter((code): code is string => Boolean(code)),
  }));

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = GaugeAndToolsCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { specifications, serialNoGenReq, refNo: incomingRefNo, ...toolData } = parsed.data;
  const serialFlag = normalizeSerialFlag(serialNoGenReq);
  // CREAT_USER_ID_CD FK → ERP_USER.USER_ID (app username e.g. "admin" is not an ERP user)
  let userId: string;
  try {
    userId = await resolveErpAuditUserId(authCheck.session);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No valid ERP user for audit fields",
      },
      { status: 500 }
    );
  }
  const defaults = erpCreateDefaults();

  const toolNo = toolData.toolOrGaugeNo.trim().toUpperCase();
  if (!toolNo) {
    return NextResponse.json({ error: "Tool Number is required" }, { status: 400 });
  }
  if (!toolData.grouping?.trim()) {
    return NextResponse.json({ error: "Tools Group is required" }, { status: 400 });
  }
  if (!toolData.name?.trim()) {
    return NextResponse.json({ error: "Tools Name is required" }, { status: 400 });
  }
  if (serialFlag === "Y" && Number(toolData.totQty) <= 0) {
    return NextResponse.json(
      { error: "Serial generation requires Total Qty greater than 0" },
      { status: 400 }
    );
  }
  if (
    toolData.historyCardReq === "Yes" &&
    (toolData.calibrationFrqMonths == null || toolData.calibrationFrqMonths <= 0)
  ) {
    return NextResponse.json(
      { error: "Calibration Frequency (months) must be > 0 when History Card = Yes" },
      { status: 400 }
    );
  }

  const normalized = normalizeLocationAndLookups({
    location: toolData.location,
    locationName: toolData.locationName,
    area: toolData.area,
    rack: toolData.rack,
    deptName: toolData.deptName,
    hsnCode: toolData.hsnCode,
    stiffness: toolData.stiffness,
    issueType: toolData.issueType,
    companyId: toolData.companyId,
    range: toolData.range,
    leastCount: toolData.leastCount,
    calibrationResponsibility: toolData.calibrationResponsibility,
  });

  try {
    const existing = await prisma.gaugeAndTools.findFirst({
      where: { toolOrGaugeNo: toolNo },
      select: { refNo: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Tool Number ${toolNo} already exists (REF_NO ${existing.refNo})` },
        { status: 409 }
      );
    }

    const tool = await prisma.$transaction(async (tx) => {
      const nextRef =
        incomingRefNo ??
        ((await tx.gaugeAndTools.aggregate({ _max: { refNo: true } }))._max.refNo ?? 0) + 1;

      const created = await tx.gaugeAndTools.create({
        data: {
          ...toolData,
          ...normalized,
          toolOrGaugeNo: toolNo,
          name: toolData.name.trim(),
          grouping: toolData.grouping.trim(),
          type: stripPlaceholder(toolData.type) ?? null,
          description: stripPlaceholder(toolData.description) ?? null,
          refNo: nextRef,
          serialNoGenReq: serialFlag ?? "N",
          qtyIn: toolData.qtyIn ?? toolData.totQty,
          qtyOut: toolData.qtyOut ?? 0,
          qtyNew: toolData.qtyNew ?? 0,
          qtyInUse: toolData.qtyInUse ?? 0,
          issueType: normalized.issueType ?? defaults.issueType,
          uom: stripPlaceholder(toolData.uom) ?? defaults.uom,
          returnable: toolData.returnable ?? defaults.returnable,
          activeItem: toolData.activeItem ?? defaults.activeItem,
          criticalItem: toolData.criticalItem ?? defaults.criticalItem,
          poReq: toolData.poReq ?? defaults.poReq,
          stockReq: toolData.stockReq ?? defaults.stockReq,
          stockItem: toolData.stockItem ?? defaults.stockItem,
          isAsset: toolData.isAsset ?? defaults.isAsset,
          saleableItem: toolData.saleableItem ?? defaults.saleableItem,
          nocReq: toolData.nocReq ?? defaults.nocReq,
          machineSoftware: toolData.machineSoftware ?? defaults.machineSoftware,
          ineligibleForItc: toolData.ineligibleForItc ?? defaults.ineligibleForItc,
          isCustGiven: toolData.isCustGiven ?? defaults.isCustGiven,
          historyCardReq: toolData.historyCardReq ?? defaults.historyCardReq,
          companyId: normalized.companyId ?? defaults.companyId,
          // Do not invent a lifecycle STATUS — ERP leaves this null for new items.
          status: toolData.status === undefined ? null : toolData.status,
          creatUserIdCd: userId,
          creatDt: new Date(),
          lstUpdtUserIdCd: userId,
        },
      });

      if (serialFlag === "Y" && created.totQty && Number(created.totQty) > 0) {
        const maxSerial =
          (await tx.gaugeSerialNo.aggregate({ _max: { refNo: true } }))._max.refNo ??
          created.refNo * 1000;
        const seedPre =
          isAssetYes(created.isAsset) || (created.preventiveFrqMonths ?? 0) > 0
            ? computeNextPreDate({
                frequencyMonths:
                  created.preventiveFrqMonths && created.preventiveFrqMonths > 0
                    ? created.preventiveFrqMonths
                    : 6,
              })
            : null;
        const serials = Array.from({ length: Number(created.totQty) }, (_, i) => ({
          refNo: maxSerial + i + 1,
          toolOrGaugeNo: created.toolOrGaugeNo,
          toolRefNo: created.refNo,
          serialNo: i + 1,
          status: "AVAILABLE FOR USE",
          nextPreDate: seedPre,
          creatUserIdCd: userId,
          creatDt: new Date(),
        }));
        await tx.gaugeSerialNo.createMany({ data: serials });
      }

      if (specifications && specifications.length > 0) {
        const specRows = specifications
          .map((s) => ({
            toolRefNo: created.refNo,
            parameter: s.parameter || s.specName || "",
            specification: s.specification || s.specValue,
            minRange: s.minRange || s.unit,
            maxRange: s.maxRange,
          }))
          .filter((s) => s.parameter);
        if (specRows.length > 0) {
          const maxSpecRow =
            (await tx.toolsSpecification.aggregate({ _max: { rowId: true } }))._max
              .rowId ?? 0;
          await tx.toolsSpecification.createMany({
            data: specRows.map((row, i) => ({ ...row, rowId: maxSpecRow + i + 1 })),
          });
        }
      }

      return created;
    });

    // Best-effort only — GAUGE_CONTROL_CARD.ROW_ID is NOT identity in ERP,
    // and failures must not roll back the tool create.
    if (tool.toolOrGaugeNo && tool.toolOrGaugeNo.length <= 15) {
      try {
        const existing = await prisma.gaugeControlCard.findUnique({
          where: { toolOrGaugeNo: tool.toolOrGaugeNo },
        });
        if (!existing) {
          const maxRow =
            (await prisma.gaugeControlCard.aggregate({ _max: { rowId: true } }))
              ._max.rowId ?? 0;
          await prisma.gaugeControlCard.create({
            data: {
              rowId: maxRow + 1,
              toolOrGaugeNo: tool.toolOrGaugeNo,
              type: "Gauge",
              creatUserIdCd: userId,
              creatDt: new Date(),
            },
          });
        }
      } catch (cardErr) {
        console.warn("GAUGE_CONTROL_CARD create skipped:", cardErr);
      }
    }

    return NextResponse.json({ ok: true, tool }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tools failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create tool",
      },
      { status: 500 }
    );
  }
}
