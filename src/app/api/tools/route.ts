import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { checkModulePermission } from "@/lib/rbac";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { GaugeAndToolsCreateSchema } from "@/lib/validators";
import {
  erpCreateDefaults,
  normalizeLocationAndLookups,
  stripPlaceholder,
} from "@/lib/toolCreate";
import { seedSerialsToMatchTotQty } from "@/lib/toolSerialSeed";
import { mapSpecInputsToPersist } from "@/lib/toolSpecRows";
import {
  normalizeCompanyUnit,
  scopeKeyToUnit,
  unitStorageVariants,
  type CompanyUnitLabel,
} from "@/lib/companyUnits";

function normalizeSerialFlag(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? "Y" : "N";
  const text = String(value).trim().toUpperCase();
  if (text === "YES" || text === "Y") return "Y";
  if (text === "NO" || text === "N") return "N";
  return String(value).slice(0, 5);
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

function prismaWriteErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const msg = error.message;
  const unknown = msg.match(/Unknown argument `([^`]+)`/);
  if (unknown) {
    return `Save blocked: field "${unknown[1]}" is not on the DB client. Restart the dev server after prisma generate.`;
  }
  if (/String or binary data would be truncated/i.test(msg)) {
    return "One or more fields exceed the ERP column length.";
  }
  if (/UNIQUE|duplicate|Violation of UNIQUE/i.test(msg)) {
    return "Tool Number already exists.";
  }
  if (/FOREIGN KEY/i.test(msg)) {
    return "Save blocked by ERP user FK — audit user could not be resolved.";
  }
  const line = msg
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^(Unknown|Invalid|Argument|Cannot|The |Violation|Error)/i.test(l));
  return (line || msg).slice(0, 280);
}

const INSTRUMENT_STATUS_FILTERS = [
  "Active",
  "Under Calibration",
  "Out of Service",
  "Status Missing",
  "No Unit",
] as const;

/** Status tabs on Instrument Master mirror the table's Status and Used Unit columns. */
function instrumentStatusWhere(filter: string): Record<string, unknown> | null {
  switch (filter) {
    case "Active":
      return { status: { in: ["Active", "Available"] } };
    case "Under Calibration":
      return { status: "Under Calibration" };
    case "Out of Service":
      return { status: "Out of Service" };
    case "Status Missing":
      return { OR: [{ status: null }, { status: "" }] };
    case "No Unit":
      return {
        OR: [
          { locationName: null },
          { locationName: "" },
          { locationName: "-Select-" },
        ],
      };
    default:
      return null;
  }
}

function instrumentDisplayStatus(status: string | null, locationName: string | null): string {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "under calibration") return "Under Calibration";
  if (normalized === "out of service") return "Out of Service";
  if (normalized === "active" || normalized === "available") return "Active";
  if (!normalized) return "Status Missing";
  if (!locationName || !locationName.trim() || locationName.trim() === "-Select-") return "No Unit";
  return status!.trim();
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  // Enforce module permission: tool_master (VIEW)
  const perm = await checkModulePermission(session, "tool_master", "VIEW");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }


  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const searchField = (searchParams.get("searchField") ?? "all").toLowerCase();
  const grouping = searchParams.get("grouping") ?? "";
  const type = searchParams.get("type") ?? "";
  const name = searchParams.get("name") ?? "";
  const status = searchParams.get("status") ?? "";
  const validity = (searchParams.get("validity") ?? "").toLowerCase();
  const onlyActive = searchParams.get("onlyActive") === "1";
  const critical = searchParams.get("critical") ?? ""; // Yes | No | ""
  const department = searchParams.get("department") ?? "";
  const requestedUnit = normalizeCompanyUnit(searchParams.get("unit"));

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
        .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
    }
  }
  if (requestedUnit && permittedUnits && !permittedUnits.includes(requestedUnit)) {
    return NextResponse.json({ error: "You do not have access to this unit" }, { status: 403 });
  }
  const effectiveUnits = requestedUnit ? [requestedUnit] : permittedUnits;

  const catalog = (searchParams.get("catalog") ?? "relevant").toLowerCase();
  /** When "1", only return tools with qtyIn > 0 (Tool Issue picker). */
  const availableOnly = searchParams.get("availableOnly") === "1";
  /** When "1", only tools with HISTORY_CARD_REQ = Yes (History Card module). */
  const historyCardOnly = searchParams.get("historyCardOnly") === "1";
  const includeCounts = searchParams.get("includeCounts") === "1";
  const sort = (searchParams.get("sort") ?? "newest").toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 20));
  const skip = (page - 1) * pageSize;

  // Instrument Master filters mirror the Status and Used Unit columns shown in its table.
  const statusWhere = status ? instrumentStatusWhere(status) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 30);
  const validityWhere = (() => {
    if (validity === "valid") {
      return { importedMasterData: { is: { nextCalibrationDue: { gt: dueSoonEnd } } } };
    }
    if (validity === "due-soon") {
      return {
        importedMasterData: {
          is: { nextCalibrationDue: { gte: today, lte: dueSoonEnd } },
        },
      };
    }
    if (validity === "overdue") {
      return { importedMasterData: { is: { nextCalibrationDue: { lt: today } } } };
    }
    if (validity === "no-due-date") {
      return {
        OR: [
          { importedMasterData: { is: null } },
          { importedMasterData: { is: { nextCalibrationDue: null } } },
        ],
      };
    }
    return null;
  })();

  const searchClause = (() => {
    if (!search.trim()) return {};
    const q = search.trim();
    const fieldMap: Record<string, object> = {
      toolorgaugeno: { toolOrGaugeNo: { contains: q } },
      description: { description: { contains: q } },
      size: { size: { contains: q } },
      name: { name: { contains: q } },
      olditemno: { oldItemNo: { contains: q } },
      location: {
        OR: [
          { location: { contains: q } },
          { locationName: { contains: q } },
          { locationOutputName: { contains: q } },
        ],
      },
    };
    if (searchField !== "all" && fieldMap[searchField]) {
      return fieldMap[searchField];
    }
    return {
      OR: [
        { toolOrGaugeNo: { contains: q } },
        { name: { contains: q } },
        { description: { contains: q } },
        { size: { contains: q } },
        { oldItemNo: { contains: q } },
        { location: { contains: q } },
        { locationName: { contains: q } },
      ],
    };
  })();

  const baseWhere = {
    AND: [
      searchClause,
      grouping ? { grouping: { contains: grouping } } : {},
      type ? { type: { contains: type } } : {},
      name ? { name: { contains: name } } : {},
      onlyActive
        ? { activeItem: { in: ["Yes", "Y"] } }
        : {},
      critical === "Yes" || critical === "No" ? { criticalItem: critical } : {},
      department ? { deptName: { contains: department } } : {},
      effectiveUnits?.length
        ? { locationName: { in: effectiveUnits.flatMap(unitStorageVariants) } }
        : {},

      catalog === "relevant"
        ? {
            OR: [
              { grouping: { contains: "INSTRUMENT" } },
              { grouping: { contains: "TOOLS AND GAUGES" } },
            ],
          }
        : catalog === "other"
          ? {
              NOT: {
                OR: [
                  { grouping: { contains: "INSTRUMENT" } },
                  { grouping: { contains: "TOOLS AND GAUGES" } },
                ],
              },
            }
          : {},
      availableOnly ? { qtyIn: { gt: 0 } } : {},
      historyCardOnly
        ? { historyCardReq: { in: ["Yes", "Y", "YES"] } }
        : {},
    ],
  };

  const where = {
    AND: [...baseWhere.AND, statusWhere ?? {}, validityWhere ?? {}],
  };

  const orderBy =
    sort === "toolno"
      ? { toolOrGaugeNo: "asc" as const }
      : sort === "name"
        ? { name: "asc" as const }
        : sort === "group"
          ? { grouping: "asc" as const }
          : { creatDt: "desc" as const };

  try {
    const [rows, total] = await Promise.all([
      prisma.gaugeAndTools.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          machineMapping: { select: { macCode: true } },
        },
      }),
      prisma.gaugeAndTools.count({ where }),
    ]);

    // Fetch serial numbers separately to avoid Prisma Engine join panic when mixing refNo and toolOrGaugeNo relations
    const toolNos = rows.map((r) => r.toolOrGaugeNo).filter((n): n is string => Boolean(n));
    const serials =
      toolNos.length > 0
        ? await prisma.gaugeSerialNo.findMany({
            where: { toolOrGaugeNo: { in: toolNos } },
            select: { refNo: true, toolOrGaugeNo: true, status: true, serialNo: true, make: true },
          })
        : [];

    const serialsByToolNo = new Map<string, typeof serials>();
    for (const s of serials) {
      if (!s.toolOrGaugeNo) continue;
      const list = serialsByToolNo.get(s.toolOrGaugeNo) ?? [];
      list.push(s);
      serialsByToolNo.set(s.toolOrGaugeNo, list);
    }

    type ImportedMasterRow = {
      refNo: number;
      calibrationDate: Date | null;
      nextCalibrationDue: Date | null;
      observedError: string | null;
      calibrationAgency: string | null;
    };
    const refNos = rows.map((row) => row.refNo);
    const importedRows = refNos.length
      ? await prisma.$queryRaw<ImportedMasterRow[]>(Prisma.sql`
          SELECT
            [REF_NO] AS [refNo],
            [CALIBRATION_DATE] AS [calibrationDate],
            [NEXT_CALIBRATION_DUE] AS [nextCalibrationDue],
            [OBSERVED_ERROR] AS [observedError],
            [CALIBRATION_AGENCY] AS [calibrationAgency]
          FROM [dbo].[TOOLS_APP_INSTRUMENT_MASTER_DATA]
          WHERE [REF_NO] IN (${Prisma.join(refNos)})
        `)
      : [];
    const importedByRefNo = new Map(importedRows.map((row) => [row.refNo, row]));

    const items = rows.map(({ machineMapping, ...tool }) => {
      const toolSerials = serialsByToolNo.get(tool.toolOrGaugeNo ?? "") ?? [];
      return {
        ...tool,
        importedMasterData: importedByRefNo.get(tool.refNo) ?? null,
        serialNumbers: toolSerials,
        computedStatus: instrumentDisplayStatus(tool.status, tool.locationName),
        machines: machineMapping
          .map((m) => m.macCode)
          .filter((code): code is string => Boolean(code)),
      };
    });

  // Enrich each item with nextCalibDate from latest GaugeControlCardTrans
  const enrichToolNos = items.map((t) => t.toolOrGaugeNo).filter(Boolean) as string[];
  const nextCalibMap: Map<string, Date | null> = new Map();
  if (enrichToolNos.length > 0) {
    try {
      // Get latest calibration card history per tool
      const cards = await prisma.gaugeControlCard.findMany({
        where: { toolOrGaugeNo: { in: enrichToolNos.map((n) => n.slice(0, 15)) } },
        select: {
          toolOrGaugeNo: true,
          history: { orderBy: { cDate: "desc" as const }, take: 1, select: { nextCDate: true } },
        },
      });
      for (const card of cards) {
        const nextCDate = card.history[0]?.nextCDate ?? null;
        nextCalibMap.set(card.toolOrGaugeNo, nextCDate ? new Date(nextCDate) : null);
      }
    } catch {
      // non-critical enrichment
    }
  }

  const enriched = items.map((t) => {
    let nextCalibDate = nextCalibMap.get(t.toolOrGaugeNo?.slice(0, 15) ?? "") ?? null;



    // If no history found but frequency is set, derive from tool creation date + frequency
    if (!nextCalibDate && (t.calibrationFrqMonths ?? 0) > 0) {
      const base = t.creatDt ? new Date(t.creatDt as unknown as string) : today;
      const derived = new Date(base);
      derived.setMonth(derived.getMonth() + (t.calibrationFrqMonths ?? 1));
      nextCalibDate = derived;
    }

    // Validity/Calibration Due is ALWAYS computed live at request time
    // (Next Calibration Due − CURRENT_DATE) — never read from a stored column.
    let calibDueStatus: "overdue" | "due-soon" | "ok" | null = null;
    let calibDueInDays: number | null = null;
    if (nextCalibDate) {
      calibDueInDays = Math.ceil((nextCalibDate.getTime() - today.getTime()) / 86400000);
      calibDueStatus =
        calibDueInDays < 0 ? "overdue" : calibDueInDays <= 30 ? "due-soon" : "ok";
    }
    return {
      ...t,
      nextCalibDate: nextCalibDate ? nextCalibDate.toISOString() : null,
      calibDueStatus,
      calibDueInDays,
    };
  });

  let statusCounts: Record<string, number> | undefined;
  let validityCounts: Record<string, number> | undefined;
  if (includeCounts) {
    const [allCount, ...perStatus] = await Promise.all([
      prisma.gaugeAndTools.count({ where: baseWhere }),
      ...INSTRUMENT_STATUS_FILTERS.map((badge) => {
        const sw = instrumentStatusWhere(badge);
        return prisma.gaugeAndTools.count({
          where: { AND: [...baseWhere.AND, sw ?? {}] },
        });
      }),
    ]);
    statusCounts = { All: allCount };
    INSTRUMENT_STATUS_FILTERS.forEach((badge, i) => {
      statusCounts![badge] = perStatus[i] ?? 0;
    });

    const validityFilters = {
      Valid: { importedMasterData: { is: { nextCalibrationDue: { gt: dueSoonEnd } } } },
      "Due Soon": {
        importedMasterData: { is: { nextCalibrationDue: { gte: today, lte: dueSoonEnd } } },
      },
      Overdue: { importedMasterData: { is: { nextCalibrationDue: { lt: today } } } },
      "No Due Date": {
        OR: [
          { importedMasterData: { is: null } },
          { importedMasterData: { is: { nextCalibrationDue: null } } },
        ],
      },
    };
    const validityValues = await Promise.all(
      Object.values(validityFilters).map((filter) =>
        prisma.gaugeAndTools.count({ where: { AND: [...baseWhere.AND, filter] } })
      )
    );
    validityCounts = { All: allCount };
    Object.keys(validityFilters).forEach((label, index) => {
      validityCounts![label] = validityValues[index] ?? 0;
    });
  }

    return NextResponse.json({
      items: enriched,
      total,
      page,
      pageSize,
      ...(statusCounts ? { statusCounts } : {}),
      ...(validityCounts ? { validityCounts } : {}),
    });
  } catch (error) {
    console.error("GET /api/tools failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tools" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  // Enforce module permission: tool_master (CREATE)
  const rbacPerm = await checkModulePermission(session, "tool_master", "CREATE");
  if (!rbacPerm.allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

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
  if (toolData.calibrationFrqMonths == null || toolData.calibrationFrqMonths <= 0) {
    return NextResponse.json(
      { error: "Calibration Frequency (months) must be greater than 0" },
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
        data: omitUndefined({
          ...toolData,
          ...normalized,
          toolOrGaugeNo: toolNo,
          name: toolData.name.trim(),
          grouping: toolData.grouping.trim(),
          type: stripPlaceholder(toolData.type) ?? null,
          description: toolData.description ?? null,
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
          historyCardReq: "Yes",
          companyId: normalized.companyId ?? defaults.companyId,
          // Do not invent a lifecycle STATUS — ERP leaves this null for new items.
          status: toolData.status === undefined ? null : toolData.status,
          creatUserIdCd: userId,
          creatDt: new Date(),
          lstUpdtUserIdCd: userId,
        }) as Parameters<typeof tx.gaugeAndTools.create>[0]["data"],
      });

      if (serialFlag === "Y") {
        await seedSerialsToMatchTotQty(tx, {
          toolRefNo: created.refNo,
          toolOrGaugeNo: created.toolOrGaugeNo,
          totQty: created.totQty ? Number(created.totQty) : null,
          userId,
          isAsset: created.isAsset,
          preventiveFrqMonths: created.preventiveFrqMonths,
          purchaseDt: body.unitPurchaseDt || body.purchaseDt,
        });
      }

      const specRows = mapSpecInputsToPersist(created.refNo, specifications);
      if (specRows.length > 0) {
        const maxSpecRow =
          (await tx.toolsSpecification.aggregate({ _max: { rowId: true } }))._max
            .rowId ?? 0;
        await tx.toolsSpecification.createMany({
          data: specRows.map((row, i) => ({ ...row, rowId: maxSpecRow + i + 1 })),
        });
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
        error: prismaWriteErrorMessage(error, "Failed to create tool"),
      },
      { status: 500 }
    );
  }
}
