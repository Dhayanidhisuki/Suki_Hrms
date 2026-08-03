import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  normalizeHeaderKey,
  parseBasicRow,
  parseFullRow,
  parsePriceRow,
  parseTemplateKind,
  type BasicImportData,
  type FullImportData,
  type ImportTemplateKind,
  type PriceImportData,
} from "@/lib/toolsMasterImportExport";

type RejectedRow = { row: number; reason: string };
type PreviewAction = "create" | "update";

type AcceptedBasic = {
  row: number;
  action: PreviewAction;
  toolOrGaugeNo: string;
  template: "basic";
  data: BasicImportData;
};

type AcceptedFull = {
  row: number;
  action: PreviewAction;
  toolOrGaugeNo: string;
  template: "full";
  data: FullImportData;
};

type AcceptedPrice = {
  row: number;
  action: "update";
  toolOrGaugeNo: string;
  template: "price";
  data: PriceImportData;
};

type AcceptedRow = AcceptedBasic | AcceptedFull | AcceptedPrice;

async function loadLookupMaps() {
  const [groups, types] = await Promise.all([
    prisma.otherToolsType.findMany({ select: { rowId: true, otherType: true } }),
    prisma.qmsOtherToolsType.findMany({
      select: { qmsOtherTypeOfTools: true, refGroupId: true },
    }),
  ]);

  const groupByName = new Map<string, number>();
  for (const g of groups) {
    const name = (g.otherType ?? "").trim();
    if (name) groupByName.set(name.toLowerCase(), g.rowId);
  }

  const typesByGroup = new Map<number, Set<string>>();
  for (const t of types) {
    if (t.refGroupId == null) continue;
    const name = (t.qmsOtherTypeOfTools ?? "").trim();
    if (!name) continue;
    if (!typesByGroup.has(t.refGroupId)) typesByGroup.set(t.refGroupId, new Set());
    typesByGroup.get(t.refGroupId)!.add(name.toLowerCase());
  }

  return { groupByName, typesByGroup };
}

function validateGroupingType(
  grouping: string,
  type: string | null,
  groupByName: Map<string, number>,
  typesByGroup: Map<number, Set<string>>
): string | null {
  const groupId = groupByName.get(grouping.toLowerCase());
  if (groupId == null) {
    return `GROUPING '${grouping}' not found in OTHER_TOOLS_TYPE`;
  }
  if (type) {
    const allowed = typesByGroup.get(groupId);
    if (!allowed || !allowed.has(type.toLowerCase())) {
      return `TYPE '${type}' not found in QMS_OTHER_TOOLS_TYPE for GROUPING '${grouping}'`;
    }
  }
  return null;
}

function normalizeSheetRows(rawRows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rawRows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[normalizeHeaderKey(key)] = value;
    }
    return out;
  });
}

async function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return normalizeSheetRows(json);
}

async function buildPreview(template: ImportTemplateKind, rawRows: Record<string, unknown>[]) {
  const toolNos = rawRows
    .map((r) => String(r.TOOL_OR_GAUGE_NO ?? "").trim())
    .filter(Boolean);

  const existing = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: toolNos } },
    select: { toolOrGaugeNo: true },
  });
  const existingSet = new Set(
    existing.map((e) => (e.toolOrGaugeNo ?? "").trim().toLowerCase()).filter(Boolean)
  );

  const { groupByName, typesByGroup } =
    template === "price"
      ? { groupByName: new Map<string, number>(), typesByGroup: new Map<number, Set<string>>() }
      : await loadLookupMaps();

  const rejected: RejectedRow[] = [];
  const accepted: AcceptedRow[] = [];
  const seenInFile = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const excelRow = idx + 2;

    if (template === "price") {
      const parsed = parsePriceRow(raw);
      if (!parsed.ok) {
        rejected.push({ row: excelRow, reason: parsed.reason });
        return;
      }
      const key = parsed.data.toolOrGaugeNo.toLowerCase();
      if (seenInFile.has(key)) {
        rejected.push({
          row: excelRow,
          reason: `Duplicate TOOL_OR_GAUGE_NO '${parsed.data.toolOrGaugeNo}' in import file`,
        });
        return;
      }
      seenInFile.add(key);
      if (!existingSet.has(key)) {
        rejected.push({
          row: excelRow,
          reason: `TOOL_OR_GAUGE_NO '${parsed.data.toolOrGaugeNo}' not found — Price Update Only never creates tools`,
        });
        return;
      }
      accepted.push({
        row: excelRow,
        action: "update",
        toolOrGaugeNo: parsed.data.toolOrGaugeNo,
        template: "price",
        data: parsed.data,
      });
      return;
    }

    const parsed = template === "full" ? parseFullRow(raw) : parseBasicRow(raw);
    if (!parsed.ok) {
      rejected.push({ row: excelRow, reason: parsed.reason });
      return;
    }

    const lookupErr = validateGroupingType(
      parsed.data.grouping,
      parsed.data.type,
      groupByName,
      typesByGroup
    );
    if (lookupErr) {
      rejected.push({ row: excelRow, reason: lookupErr });
      return;
    }

    const key = parsed.data.toolOrGaugeNo.toLowerCase();
    if (seenInFile.has(key)) {
      rejected.push({
        row: excelRow,
        reason: `Duplicate TOOL_OR_GAUGE_NO '${parsed.data.toolOrGaugeNo}' in import file`,
      });
      return;
    }
    seenInFile.add(key);

    const action: PreviewAction = existingSet.has(key) ? "update" : "create";
    if (template === "full") {
      accepted.push({
        row: excelRow,
        action,
        toolOrGaugeNo: parsed.data.toolOrGaugeNo,
        template: "full",
        data: parsed.data as FullImportData,
      });
    } else {
      accepted.push({
        row: excelRow,
        action,
        toolOrGaugeNo: parsed.data.toolOrGaugeNo,
        template: "basic",
        data: parsed.data as BasicImportData,
      });
    }
  });

  return {
    createCount: accepted.filter((a) => a.action === "create").length,
    updateCount: accepted.filter((a) => a.action === "update").length,
    rejectCount: rejected.length,
    rejected,
    accepted,
  };
}

async function applyConfirm(template: ImportTemplateKind, pendingRows: AcceptedRow[], userId: string) {
  const { groupByName, typesByGroup } =
    template === "price"
      ? { groupByName: new Map<string, number>(), typesByGroup: new Map<number, Set<string>>() }
      : await loadLookupMaps();

  const revalidated: AcceptedRow[] = [];
  const rejected: RejectedRow[] = [];

  for (const item of pendingRows) {
    if (item.template !== template) {
      rejected.push({ row: item.row, reason: "Template mismatch in confirm payload" });
      continue;
    }

    if (template === "price") {
      const data = item.data as PriceImportData;
      if (!data?.toolOrGaugeNo || data.price == null || data.price < 0 || !Number.isFinite(data.price)) {
        rejected.push({ row: item.row, reason: "Invalid price row in confirm payload" });
        continue;
      }
      revalidated.push(item);
      continue;
    }

    const data = item.data as BasicImportData | FullImportData;
    if (!data?.toolOrGaugeNo || !data.grouping || !data.name) {
      rejected.push({ row: item.row, reason: "Missing required fields in confirm payload" });
      continue;
    }
    const lookupErr = validateGroupingType(data.grouping, data.type, groupByName, typesByGroup);
    if (lookupErr) {
      rejected.push({ row: item.row, reason: lookupErr });
      continue;
    }
    revalidated.push(item);
  }

  if (rejected.length > 0) {
    return { ok: false as const, rejected };
  }

  const toolNos = revalidated.map((r) => r.toolOrGaugeNo);
  const existing = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: toolNos } },
    select: { refNo: true, toolOrGaugeNo: true },
  });
  const existingByNo = new Map(
    existing
      .filter((e) => e.toolOrGaugeNo)
      .map((e) => [e.toolOrGaugeNo!.toLowerCase(), e.refNo])
  );

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    let nextRef =
      ((await tx.gaugeAndTools.aggregate({ _max: { refNo: true } }))._max.refNo ?? 0) + 1;
    let nextSerialRef =
      ((await tx.gaugeSerialNo.aggregate({ _max: { refNo: true } }))._max.refNo ?? 0) + 1;

    for (const item of revalidated) {
      const key = item.toolOrGaugeNo.toLowerCase();

      if (item.template === "price") {
        const refNo = existingByNo.get(key);
        if (refNo == null) {
          throw new Error(
            `TOOL_OR_GAUGE_NO '${item.toolOrGaugeNo}' not found during price update`
          );
        }
        await tx.gaugeAndTools.update({
          where: { refNo },
          data: {
            price: item.data.price,
            lstUpdtUserIdCd: userId,
          },
        });
        updated += 1;
        continue;
      }

      const data = item.data;
      const toolPayload = {
        grouping: data.grouping,
        type: data.type,
        name: data.name,
        description: data.description,
        toolOrGaugeNo: data.toolOrGaugeNo,
        totQty: data.totQty,
        location: data.location,
        status: data.status,
        lstUpdtUserIdCd: userId,
        ...(item.template === "full"
          ? {
              calibrationFrqMonths: (data as FullImportData).calibrationFrqMonths,
              historyCardReq: (data as FullImportData).historyCardReq,
            }
          : {}),
      };

      let toolRefNo = existingByNo.get(key) ?? null;

      if (toolRefNo != null) {
        await tx.gaugeAndTools.update({
          where: { refNo: toolRefNo },
          data: toolPayload,
        });
        updated += 1;
      } else {
        toolRefNo = nextRef;
        await tx.gaugeAndTools.create({
          data: {
            refNo: toolRefNo,
            ...toolPayload,
            totQty: data.totQty ?? 0,
            qtyIn: data.totQty ?? 0,
            qtyOut: 0,
            qtyNew: 0,
            creatUserIdCd: userId,
          },
        });
        existingByNo.set(key, toolRefNo);
        nextRef += 1;
        created += 1;
      }

      if (item.template === "full") {
        const full = data as FullImportData;

        // TOOLS_DETAILS upsert by TOOL_REF_NO
        const hasDetailsData =
          full.noOfCavity != null ||
          full.toolLife != null ||
          full.hardness != null ||
          full.drawingNo != null;
        if (hasDetailsData) {
          const existingDetail = await tx.toolsDetails.findFirst({
            where: { toolRefNo },
          });
          const detailData = {
            noOfCavity: full.noOfCavity,
            toolLife: full.toolLife,
            hardness: full.hardness,
            drawingNo: full.drawingNo,
          };
          if (existingDetail) {
            await tx.toolsDetails.update({
              where: { rowId: existingDetail.rowId },
              data: detailData,
            });
          } else {
            await tx.toolsDetails.create({
              data: {
                toolRefNo,
                ...detailData,
                creatDt: new Date(),
              },
            });
          }
        }

        // GAUGE_SERIAL_NO upsert by TOOL_REF_NO + SERIAL_NO
        if (full.serialNo != null) {
          const existingSerial = await tx.gaugeSerialNo.findFirst({
            where: { toolRefNo, serialNo: full.serialNo },
          });
          if (existingSerial) {
            await tx.gaugeSerialNo.update({
              where: { refNo: existingSerial.refNo },
              data: {
                make: full.make,
                toolOrGaugeNo: full.toolOrGaugeNo,
              },
            });
          } else {
            await tx.gaugeSerialNo.create({
              data: {
                refNo: nextSerialRef,
                toolRefNo,
                toolOrGaugeNo: full.toolOrGaugeNo,
                serialNo: full.serialNo,
                make: full.make,
                status: "Available",
                creatUserIdCd: userId,
                creatDt: new Date(),
              },
            });
            nextSerialRef += 1;
          }
        }
      }
    }

    return { created, updated };
  });

  return { ok: true as const, ...result };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = String(form.get("action") ?? "preview");
      if (action !== "preview") {
        return NextResponse.json(
          { error: "multipart upload is only valid for action=preview" },
          { status: 400 }
        );
      }

      const template = parseTemplateKind(form.get("template"));
      if (!template) {
        return NextResponse.json(
          { error: "template is required (basic | full | price)" },
          { status: 400 }
        );
      }

      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
      }
      if (file.size > IMPORT_MAX_FILE_BYTES) {
        return NextResponse.json(
          {
            error: `File too large. Maximum size is ${IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB.`,
          },
          { status: 400 }
        );
      }

      const rawRows = await parseWorkbook(await file.arrayBuffer());
      if (rawRows.length === 0) {
        return NextResponse.json({ error: "Import file has no data rows" }, { status: 400 });
      }
      if (rawRows.length > IMPORT_MAX_ROWS) {
        return NextResponse.json(
          {
            error: `Import file has ${rawRows.length.toLocaleString()} rows. Maximum is ${IMPORT_MAX_ROWS.toLocaleString()} rows.`,
          },
          { status: 400 }
        );
      }

      const preview = await buildPreview(template, rawRows);
      return NextResponse.json({
        ok: true,
        action: "preview",
        template,
        createCount: preview.createCount,
        updateCount: preview.updateCount,
        rejectCount: preview.rejectCount,
        rejected: preview.rejected,
        pendingRows: preview.accepted,
      });
    }

    const body = await req.json();
    if (body?.action !== "confirm") {
      return NextResponse.json(
        { error: "Expected action=confirm with pendingRows, or multipart preview upload" },
        { status: 400 }
      );
    }

    const template = parseTemplateKind(body.template);
    if (!template) {
      return NextResponse.json(
        { error: "template is required (basic | full | price)" },
        { status: 400 }
      );
    }

    const pendingRows = Array.isArray(body.pendingRows) ? body.pendingRows : [];
    if (pendingRows.length === 0) {
      return NextResponse.json(
        { error: "No accepted rows to import. Re-upload and review the preview." },
        { status: 400 }
      );
    }
    if (pendingRows.length > IMPORT_MAX_ROWS) {
      return NextResponse.json(
        { error: `Cannot import more than ${IMPORT_MAX_ROWS.toLocaleString()} rows.` },
        { status: 400 }
      );
    }

    const erpActor = await resolveErpAuditUserId(authCheck.session);
    const applied = await applyConfirm(
      template,
      pendingRows as AcceptedRow[],
      erpActor
    );

    if (!applied.ok) {
      return NextResponse.json(
        {
          error: "Confirm blocked — one or more rows failed re-validation",
          rejected: applied.rejected,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: "confirm",
      template,
      created: applied.created,
      updated: applied.updated,
    });
  } catch (error) {
    console.error("Tools master import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
