import { NextRequest, NextResponse } from "next/server";
import { checkModulePermission } from "@/lib/rbac";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  normalizeHeaderKey,
  parseDate,
  parseMasterRow,
  type MasterImportData,
} from "@/lib/toolsMasterImportExport";

// Allow long-running whole-workbook confirmations on hosts that honor the
// Next.js route duration hint.
export const maxDuration = 600;

// ─── Types ─────────────────────────────────────────────────────────────────

type RejectedRow = {
  row: number;
  reason: string;
  /** Normalised original workbook cells, used for fix-and-re-upload export. */
  original?: Record<string, unknown>;
};
type PreviewAction = "create" | "update";

type AcceptedRow = {
  row: number;
  action: PreviewAction;
  /** Display label e.g. "MP3-DVC-01 · Unit 3" */
  label: string;
  equipNo: string;
  data: MasterImportData;
  original?: Record<string, unknown>;
};

// ─── XLSX parsing ───────────────────────────────────────────────────────────

/**
 * Parse the first worksheet.  The client's sheet has metadata on rows 1–3
 * and the actual column header on row 4 (0-indexed row 3).  We detect this
 * by trying row 4 first: if the normalised keys of that row contain
 * "EQUIP_NO" we use it as the header row, otherwise fall back to the default
 * (first row is header) so the same parser handles test files too.
 */
async function parseWorkbook(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const decodedRange = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:P1");
  // Some client workbooks have formatting applied through XFC, despite data
  // existing only in A:P. Capping columns prevents thousands of empty cells
  // from entering preview/confirm payloads.
  const masterDataRange = {
    s: { r: 3, c: 0 },
    e: { r: decodedRange.e.r, c: 15 },
  };

  // Try header at row 4 (range offset = 3) first
  const jsonRow4 = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    range: masterDataRange,
  });

  const firstKeys =
    jsonRow4.length > 0
      ? Object.keys(jsonRow4[0]).map((k) => normalizeHeaderKey(k))
      : [];

  if (firstKeys.includes("EQUIP_NO")) {
    return jsonRow4.map((row, index) => ({
      ...normaliseRow(row),
      __EXCEL_ROW: index + 5,
    }));
  }

  // Fallback: first-row header (useful for test uploads without metadata rows)
  const jsonDefault = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return jsonDefault.map((row, index) => ({
    ...normaliseRow(row),
    __EXCEL_ROW: index + 2,
  }));
}

function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[normalizeHeaderKey(key)] = value;
  }
  return out;
}

// ─── Preview ────────────────────────────────────────────────────────────────

async function buildPreview(rawRows: Record<string, unknown>[]) {

  // 2. Collect all equip numbers to check which already exist in the DB
  const equipNos = rawRows
    .map((r) => String(r["EQUIP_NO"] ?? "").trim())
    .filter(Boolean);

  const existingTools = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: equipNos } },
    select: { toolOrGaugeNo: true, refNo: true },
  });
  const existingToolSet = new Set(
    existingTools.map((e) => (e.toolOrGaugeNo ?? "").trim().toLowerCase())
  );


  const rejected: RejectedRow[] = [];
  const accepted: AcceptedRow[] = [];
  // Composite dedup key: equipNo.lower() + "|||" + usedUnit.lower()
  const seenInFile = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const excelRow = Number(raw.__EXCEL_ROW) || idx + 2;

    const parsed = parseMasterRow(raw);
    if (!parsed.ok) {
      rejected.push({ row: excelRow, reason: parsed.reason, original: raw });
      return;
    }

    const { equipNo } = parsed.data;

    const compositeKey = `${equipNo.trim().toLowerCase()}`;

    // Repeated tool rows are valid historical calibration events. The
    // first occurrence creates/updates unit stock; later rows update the same
    // snapshot and append their own control-card history entry.
    const repeatedInFile = seenInFile.has(compositeKey);
    seenInFile.add(compositeKey);

    // Create vs Update: if (tool) exists in DB → update, else create
    const action: PreviewAction = repeatedInFile || existingToolSet.has(compositeKey)
      ? "update"
      : "create";

    accepted.push({
      row: excelRow,
      action,
      label: equipNo,
      equipNo,
      data: parsed.data,
      original: raw,
    });

    // If the tool itself doesn't exist yet, record it so duplicate tool
    // combos later in the same file resolve correctly for the new-tool case
    existingToolSet.add(equipNo.trim().toLowerCase());
  });

  return {
    createCount: accepted.filter((a) => a.action === "create").length,
    updateCount: accepted.filter((a) => a.action === "update").length,
    rejectCount: rejected.length,
    rejected,
    accepted,
  };
}

// ─── Confirm / Apply ────────────────────────────────────────────────────────

async function applyConfirm(pendingRows: AcceptedRow[], userId: string) {

  const revalidated: AcceptedRow[] = [];
  const rejected: RejectedRow[] = [];

  for (const item of pendingRows) {
    const d = item.data as MasterImportData;
    if (!d?.equipNo) {
      rejected.push({ row: item.row, reason: "Missing required fields in confirm payload", original: item.original });
      continue;
    }
    const calibDate = parseDate("Calibration date", d.calibDate);
    if (!calibDate.ok) {
      rejected.push({ row: item.row, reason: calibDate.reason, original: item.original });
      continue;
    }
    const nextCalibDate = parseDate("Next Calibration Due", d.nextCalibDate);
    if (!nextCalibDate.ok) {
      rejected.push({ row: item.row, reason: nextCalibDate.reason, original: item.original });
      continue;
    }
    // Dates cross the preview/confirm boundary as JSON strings; restore real
    // Date objects after performing the SQL Server range check.
    d.calibDate = calibDate.value;
    d.nextCalibDate = nextCalibDate.value;
    revalidated.push(item);
  }

  if (revalidated.length === 0) {
    return { ok: false as const, rejected };
  }

  // Load all existing tool records by equip number
  const allEquipNos = revalidated.map((r) => r.equipNo);
  const existingTools = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: allEquipNos } },
    select: { refNo: true, toolOrGaugeNo: true },
  });
  const toolRefByEquipNo = new Map(
    existingTools
      .filter((e) => e.toolOrGaugeNo)
      .map((e) => [e.toolOrGaugeNo!.trim().toLowerCase(), e.refNo])
  );


  // Load existing GAUGE_CONTROL_CARD rows (by toolOrGaugeNo, first 15 chars)
  const existingCards = await prisma.gaugeControlCard.findMany({
    where: {
      toolOrGaugeNo: {
        in: allEquipNos.map((n) => n.slice(0, 15)),
      },
    },
    select: { rowId: true, toolOrGaugeNo: true },
  });
  const cardRowIdByToolNo = new Map(
    existingCards.map((c) => [c.toolOrGaugeNo.trim().toLowerCase(), c.rowId])
  );

  const result = await prisma.$transaction(async (tx) => {
    // Serialize import confirmations without holding Serializable range locks
    // across GAUGEANDTOOLS for the entire workbook.
    await tx.$executeRawUnsafe(`
      DECLARE @lockResult int;
      EXEC @lockResult = sys.sp_getapplock
        @Resource = N'SUKI_TOOLS_EXCEL_IMPORT',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 30000;
      IF @lockResult < 0 THROW 51000, 'Another tools Excel import is already running.', 1;
    `);
    let created = 0;
    let updated = 0;

    // Sequence counters — allocated once, incremented as rows are processed
    let nextRef =
      ((await tx.gaugeAndTools.aggregate({ _max: { refNo: true } }))._max.refNo ?? 0) + 1;
    let nextCardRowId =
      ((await tx.gaugeControlCard.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
    let nextCardTransRowId =
      ((await tx.gaugeControlCardTrans.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
    const controlCardHistoryRows: Array<{
      rowId: number;
      refNo: number;
      cDate: Date;
      nextCDate: Date | null;
      remarks: string | null;
      creatDt: Date;
      creatUserIdCd: string;
    }> = [];

    // Track which equipNos we have already written master fields for in this
    // import run (first-occurrence wins for master-level fields)
    const writtenMasterFields = new Set<string>();

    for (const item of revalidated) {
      const data = item.data;
      const equipKey = data.equipNo.trim().toLowerCase();
      // ── 1. Upsert GAUGEANDTOOLS (master fields — first occurrence only) ──

      let toolRefNo = toolRefByEquipNo.get(equipKey) ?? null;

      if (toolRefNo == null) {
        // First time we see this equip number → CREATE
        const masterPayload = buildMasterPayload(data, userId);
        toolRefNo = nextRef;
        await tx.gaugeAndTools.create({
          data: {
            refNo: toolRefNo,
            totQty: 1,
            ...masterPayload,
            creatUserIdCd: userId,
            creatDt: new Date(),
          },
        });
        created += 1;
        toolRefByEquipNo.set(equipKey, toolRefNo);
        nextRef += 1;
      } else if (!writtenMasterFields.has(equipKey)) {
        // Tool exists in DB but this is the first occurrence in the file
        // → UPDATE master fields
        await tx.gaugeAndTools.update({
          where: { refNo: toolRefNo },
          data: {
            ...buildMasterPayload(data, userId),
            lstUpdtUserIdCd: userId,
          },
        });
        updated += 1;
      }
      // Subsequent occurrences for the same equip number (different unit) →
      // do NOT update master fields (first-occurrence rule)
      writtenMasterFields.add(equipKey);

      // Preserve the exact workbook-only master values in the app-owned
      // companion row. Use parameterized SQL so an already-running Next dev
      // server with a pre-generation Prisma transaction client can still
      // complete the import. Repeated equipment numbers use the last row.
      const importedUpdatedAt = new Date();
      const updatedImported = await tx.$executeRaw`
        UPDATE [dbo].[TOOLS_APP_INSTRUMENT_MASTER_DATA]
        SET [CALIBRATION_DATE] = ${data.calibDate},
            [NEXT_CALIBRATION_DUE] = ${data.nextCalibDate},
            [OBSERVED_ERROR] = ${data.observedError},
            [CALIBRATION_AGENCY] = ${data.calibAgency},
            [UPDATED_AT] = ${importedUpdatedAt}
        WHERE [REF_NO] = ${toolRefNo}
      `;
      if (updatedImported === 0) {
        await tx.$executeRaw`
          INSERT INTO [dbo].[TOOLS_APP_INSTRUMENT_MASTER_DATA]
            ([REF_NO], [CALIBRATION_DATE], [NEXT_CALIBRATION_DUE], [OBSERVED_ERROR], [CALIBRATION_AGENCY], [UPDATED_AT])
          VALUES
            (${toolRefNo}, ${data.calibDate}, ${data.nextCalibDate}, ${data.observedError}, ${data.calibAgency}, ${importedUpdatedAt})
        `;
      }

      // ── 3. Seed GAUGE_CONTROL_CARD + GAUGE_CONTROL_CARD_TRANS ────────────
      // Only when a calibration date is present in the row.

      if (data.calibDate) {
        // GAUGE_CONTROL_CARD.TOOL_OR_GAUGE_NO is NVarChar(15) — truncate
        const cardToolNo = data.equipNo.slice(0, 15);
        const cardKey = cardToolNo.trim().toLowerCase();

        let cardRowId = cardRowIdByToolNo.get(cardKey);

        if (cardRowId == null) {
          // Create parent control card
          cardRowId = nextCardRowId;
          await tx.gaugeControlCard.create({
            data: {
              rowId: cardRowId,
              toolOrGaugeNo: cardToolNo,
              type: "External",
              status: "Active",
              frequency: data.calibrationFrqMonths != null
                ? String(data.calibrationFrqMonths)
                : null,
              creatUserIdCd: userId,
              creatDt: new Date(),
            },
          });
          cardRowIdByToolNo.set(cardKey, cardRowId);
          nextCardRowId += 1;
        }

        // Queue history for batched insertion after the loop. SQL Server has a
        // 2,100-parameter limit, so it is flushed in small chunks below.
        controlCardHistoryRows.push({
          rowId: nextCardTransRowId,
          refNo: cardRowId,
          cDate: data.calibDate,
          nextCDate: data.nextCalibDate,
          remarks: data.calibAgency ? data.calibAgency.slice(0, 25) : null,
          creatDt: new Date(),
          creatUserIdCd: userId,
        });
        nextCardTransRowId += 1;
      }
    }

    for (let start = 0; start < controlCardHistoryRows.length; start += 200) {
      await tx.gaugeControlCardTrans.createMany({
        data: controlCardHistoryRows.slice(start, start + 200),
      });
    }


    return { created, updated };
  }, {
    // The ERP allocates several legacy numeric keys in application code. This
    // import is restricted to one confirmation at a time in the UI; using
    // Serializable here locked the master tables for the entire large upload.
    isolationLevel: "ReadCommitted",
    // A full calibration workbook can require thousands of sequential ERP
    // writes. Prisma's 5-second interactive transaction default expires in
    // the middle of that loop and surfaces as "Transaction not found".
    maxWait: 30_000,
    timeout: 30 * 60_000,
  });

  return { ok: true as const, ...result, rejected };
}

/** Master-level fields written to GAUGEANDTOOLS. */
function buildMasterPayload(data: MasterImportData, userId: string) {
  return {
    // Required identity field
    toolOrGaugeNo: data.equipNo,
    // Optional master fields — store as-is per Q1
    description: data.description,
    size: data.size,
    make: data.make,
    leastCount: data.leastCount,
    // The client maintains one current unit per instrument, not unit-wise stock.
    locationName: data.usedUnit,
    location: data.usedLocation,
    calibrationFrqMonths: data.calibrationFrqMonths,
    status: data.status,
    remarks: data.remarks,
    // Required non-null fields on GAUGEANDTOOLS that the import doesn't touch —
    // provide safe defaults so CREATE succeeds.
    // Calibration-register imports belong to the relevant catalog by default.
    // Users can still override the group from the normal Edit form.
    grouping: "INSTRUMENTS",
    historyCardReq: "Yes",
    lstUpdtUserIdCd: userId,
  };
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "tool_master", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ── Preview (multipart upload) ─────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = String(form.get("action") ?? "preview");
      if (action !== "preview") {
        return NextResponse.json(
          { error: "multipart upload is only valid for action=preview" },
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

      const preview = await buildPreview(rawRows);
      return NextResponse.json({
        ok: true,
        action: "preview",
        template: "master",
        createCount: preview.createCount,
        updateCount: preview.updateCount,
        rejectCount: preview.rejectCount,
        rejected: preview.rejected,
        pendingRows: preview.accepted,
      });
    }

    // ── Confirm (JSON body) ───────────────────────────────────────────────
    const rawBody = await req.text();
    if (!rawBody.trim()) {
      return NextResponse.json(
        { error: "Import confirmation arrived with an empty request body. Retry this batch." },
        { status: 400 }
      );
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Import confirmation request was incomplete or invalid. Retry this batch." },
        { status: 400 }
      );
    }
    if (body?.action !== "confirm") {
      return NextResponse.json(
        { error: "Expected action=confirm with pendingRows, or multipart preview upload" },
        { status: 400 }
      );
    }

    if (body.template && body.template !== "master") {
      return NextResponse.json(
        { error: "template must be 'master' for this endpoint" },
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
    const applied = await applyConfirm(pendingRows as AcceptedRow[], erpActor);

    if (!applied.ok) {
      return NextResponse.json(
        {
          error: "Confirm blocked — no rows passed re-validation. Re-upload the workbook to refresh the preview.",
          rejected: applied.rejected,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: "confirm",
      template: "master",
      created: applied.created,
      updated: applied.updated,
      skipped: applied.rejected.length,
      rejected: applied.rejected,
    });
  } catch (error) {
    console.error("Tools master import failed:", error);
    const rawMessage = error instanceof Error ? error.message : "Import failed";
    const message =
      rawMessage.includes("Transaction not found") ||
      rawMessage.includes("old closed transaction")
        ? "The Excel import transaction expired before all rows were saved. Please retry; the failed import was rolled back."
        : rawMessage;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
