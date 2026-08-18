import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { GaugeAndToolsCreateSchema } from "@/lib/validators";
import { buildToolUnitHistory } from "@/lib/toolUnitHistory";
import { computeToolRollupStatus } from "@/lib/toolStatusRollup";
import { normalizeLocationAndLookups, stripPlaceholder } from "@/lib/toolCreate";
import { computeNextPreDate, isAssetYes } from "@/lib/preventiveFlow";
import { seedSerialsToMatchTotQty } from "@/lib/toolSerialSeed";
import { mapSpecInputsToPersist } from "@/lib/toolSpecRows";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const refNo = Number(id);
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { refNo },
    include: {
      serialNumbers: { orderBy: { serialNo: "asc" } },
      specifications: { orderBy: [{ sequence: "asc" }, { rowId: "asc" }] },
      priceMaster: { orderBy: { revDate: "desc" } },
      details: true,
      machineMapping: true,
      toolsMapping: true,
      calibControlCard: { include: { history: { orderBy: { cDate: "desc" } } } },
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  // Fetch latest calibration issue/result info for the calibration status panel
  let calibrationSummary = null;
  let movementSummary = null;
  try {
    const latestLine = await prisma.toolsTransIssueForCalibration.findFirst({
      where: { toolOrGaugeNo: tool.toolOrGaugeNo },
      orderBy: { creatDt: "desc" },
      include: {
        calibIssue: { select: { dcNo: true, issueDate: true, receiveName: true, issueFor: true } },
      },
    });

    if (latestLine) {
      // Extract certificate number from packed CALIB_RESULT_COMMENTS (format: "Cert:XXXXX | ...")
      const comments = latestLine.calibResultComments ?? "";
      const certMatch = comments.match(/Cert:([^|]+)/);
      const certNo = certMatch ? certMatch[1].trim() : null;

      calibrationSummary = {
        dcNo: latestLine.calibIssue?.dcNo ?? null,
        issueDate: latestLine.calibIssue?.issueDate ?? null,
        receiveName: latestLine.calibIssue?.receiveName ?? null,
        issueFor: latestLine.calibIssue?.issueFor ?? null,
        calibStatus: latestLine.calibrationStatus ?? null,
        resultStatus: latestLine.resultStatus ?? null,
        calibratedDate: latestLine.calibratedDate ?? null,
        calibratedBy: latestLine.calibratedBy ?? null,
        nextCalibDate: latestLine.nxtCalibDate ?? null,
        calibDueDate: latestLine.calibDueDate ?? null,
        certificateNo: certNo,
        comments: latestLine.calibResultComments ?? null,
      };

      // Heal stuck unit rows: Results Update wrote resultStatus but GAUGE_SERIAL_NO
      // was left on ISSUE FOR CALIBRATION (common when serialNo on the line was null/mismatched).
      const resultDone = String(latestLine.resultStatus ?? "").trim();
      const calibDone = String(latestLine.calibrationStatus ?? "").toUpperCase() === "DONE";
      if (resultDone || calibDone) {
        const unitStatus =
          /FAILED|REJECTED|OUT OF SERVICE|WORN OUT|BROKEN|NOT IN USE/i.test(resultDone)
            ? resultDone.slice(0, 30)
            : "AVAILABLE FOR USE";
        const stuck = tool.serialNumbers.filter((s) =>
          /ISSUE FOR CALIBRATION|UNDER CALIBRATION|RECEIVED/i.test(String(s.status ?? ""))
        );
        if (stuck.length > 0) {
          await prisma.gaugeSerialNo.updateMany({
            where: { refNo: { in: stuck.map((s) => s.refNo) } },
            data: { status: unitStatus },
          });
          for (const s of tool.serialNumbers) {
            if (stuck.some((u) => u.refNo === s.refNo)) s.status = unitStatus;
          }
        }
      }
    } else if ((tool.calibrationFrqMonths ?? 0) > 0) {
      // Never calibrated but frequency is set — derive expected next due date
      const base = tool.creatDt ? new Date(tool.creatDt) : new Date();
      const derived = new Date(base);
      derived.setMonth(derived.getMonth() + (tool.calibrationFrqMonths ?? 1));
      calibrationSummary = {
        dcNo: null,
        issueDate: null,
        receiveName: null,
        issueFor: null,
        calibStatus: "Not Started",
        resultStatus: null,
        calibratedDate: null,
        calibratedBy: null,
        nextCalibDate: derived,
        calibDueDate: derived,
        certificateNo: null,
        comments: null,
      };
    }
  } catch {
    // non-critical
  }

  try {
    const activeMovement = await prisma.toolsTransIssue.findFirst({
      where: {
        OR: [
          { toolRefNo: tool.refNo },
          ...(tool.toolOrGaugeNo ? [{ toolOrGaugeNo: tool.toolOrGaugeNo }] : []),
        ],
        status: { in: ["Open", "OPEN", "Active"] },
        header: {
          status: { in: ["Active", "OPEN", "Open", "PARTIAL"] },
          OR: [
            { issueOption: "Internal Unit Movement" },
            { issueOption: { startsWith: "External:" } },
            { lines: { some: { issueToItemNo: { not: null } } } },
          ],
        },
      },
      orderBy: { creatDt: "desc" },
      include: {
        header: {
          select: {
            dcNo: true,
            issueDate: true,
            dueDate: true,
            fromUnit: true,
            issueOption: true,
            receiveName: true,
            status: true,
          },
        },
      },
    });
    if (activeMovement) {
      const sourcePrefix = "Source rack/location: ";
      movementSummary = {
        dcNo: activeMovement.header.dcNo,
        movementType: activeMovement.header.issueOption,
        sourceUnit: activeMovement.header.fromUnit,
        destinationUnit: activeMovement.issueToItemNo,
        sourceRack: activeMovement.remarks?.startsWith(sourcePrefix)
          ? activeMovement.remarks.slice(sourcePrefix.length).trim() || null
          : null,
        issueDate: activeMovement.header.issueDate,
        expectedReceiptDate: activeMovement.header.dueDate,
        issuedTo: activeMovement.header.receiveName,
        status: activeMovement.status || activeMovement.header.status || "IN MOVEMENT",
      };
    }
  } catch {
    // Movement enrichment is non-critical to opening the instrument record.
  }

  // Build unit grid after heal so STATUS matches lifecycle panel
  const unitHistory = await buildToolUnitHistory({
    refNo: tool.refNo,
    toolOrGaugeNo: tool.toolOrGaugeNo,
    calibrationFrqMonths: tool.calibrationFrqMonths,
  });

  const computedStatus = computeToolRollupStatus(
    tool.serialNumbers.map((s) => s.status),
    tool.activeItem
  );

  return NextResponse.json({
    tool: { ...tool, unitHistory, computedStatus, calibrationSummary, movementSummary },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const refNo = Number(id);
  if (!Number.isFinite(refNo)) {
    return NextResponse.json({ error: "Invalid tool id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = GaugeAndToolsCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { specifications, serialNoGenReq, refNo: ignoredRefNo, ...updateData } = parsed.data;
  void ignoredRefNo;
  updateData.historyCardReq = "Yes";
  updateData.caliPlannedWho = "N/A";
  updateData.calibrationResponsibility = "N/A";
  if (updateData.calibrationFrqMonths !== undefined && updateData.calibrationFrqMonths <= 0) {
    return NextResponse.json(
      { error: "Calibration Frequency (months) must be greater than 0" },
      { status: 400 }
    );
  }

  const normalized = normalizeLocationAndLookups({
    location: updateData.location,
    locationName: updateData.locationName,
    area: updateData.area,
    rack: updateData.rack,
    deptName: updateData.deptName,
    hsnCode: updateData.hsnCode,
    stiffness: updateData.stiffness,
    issueType: updateData.issueType,
    companyId: updateData.companyId,
    range: updateData.range,
    leastCount: updateData.leastCount,
    calibrationResponsibility: updateData.calibrationResponsibility,
  });

  // Only overwrite location-derived fields when the client sent any of them.
  const touchedLocation =
    updateData.location !== undefined ||
    updateData.locationName !== undefined ||
    updateData.area !== undefined ||
    updateData.rack !== undefined ||
    updateData.deptName !== undefined ||
    updateData.hsnCode !== undefined ||
    updateData.stiffness !== undefined ||
    updateData.issueType !== undefined ||
    updateData.companyId !== undefined ||
    updateData.range !== undefined ||
    updateData.leastCount !== undefined ||
    updateData.calibrationResponsibility !== undefined;

  if (updateData.toolOrGaugeNo) {
    updateData.toolOrGaugeNo = updateData.toolOrGaugeNo.trim().toUpperCase();
    const clash = await prisma.gaugeAndTools.findFirst({
      where: {
        toolOrGaugeNo: updateData.toolOrGaugeNo,
        NOT: { refNo },
      },
      select: { refNo: true },
    });
    if (clash) {
      return NextResponse.json(
        {
          error: `Tool Number ${updateData.toolOrGaugeNo} already exists (REF_NO ${clash.refNo})`,
        },
        { status: 409 }
      );
    }
  }

  try {
    // LST_UPDT_USER_ID_CD may FK → ERP_USER; app username is not an ERP user
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const tool = await prisma.gaugeAndTools.update({
      where: { refNo },
      data: omitUndefined({
        ...updateData,
        ...(touchedLocation ? normalized : {}),
        ...(updateData.type !== undefined
          ? { type: stripPlaceholder(updateData.type) ?? null }
          : {}),
        ...(updateData.description !== undefined
          ? { description: updateData.description ?? null }
          : {}),
        ...(serialNoGenReq !== undefined
          ? { serialNoGenReq: normalizeSerialFlag(serialNoGenReq) }
          : {}),
        lstUpdtUserIdCd: erpActor,
      }) as Parameters<typeof prisma.gaugeAndTools.update>[0]["data"],
    });

    if (specifications) {
      await prisma.toolsSpecification.deleteMany({ where: { toolRefNo: refNo } });
      const rows = mapSpecInputsToPersist(refNo, specifications);
      if (rows.length > 0) {
        const maxRow =
          (await prisma.toolsSpecification.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0;
        await prisma.toolsSpecification.createMany({
          data: rows.map((row, i) => ({ ...row, rowId: maxRow + i + 1 })),
        });
      }
    }

    const effectiveSerialFlag =
      serialNoGenReq !== undefined
        ? normalizeSerialFlag(serialNoGenReq)
        : normalizeSerialFlag(tool.serialNoGenReq);

    // Turning serial gen on requires Tot Qty > 0 (same as create)
    if (serialNoGenReq !== undefined && effectiveSerialFlag === "Y" && Number(tool.totQty) <= 0) {
      return NextResponse.json(
        { error: "Serial generation requires Total Qty greater than 0" },
        { status: 400 }
      );
    }

    // Match ERP: unit count follows Total Qty when serial gen = Yes (adds missing only)
    if (effectiveSerialFlag === "Y" && Number(tool.totQty) > 0) {
      await seedSerialsToMatchTotQty(prisma, {
        toolRefNo: tool.refNo,
        toolOrGaugeNo: tool.toolOrGaugeNo,
        totQty: tool.totQty ? Number(tool.totQty) : null,
        userId: erpActor,
        isAsset: tool.isAsset,
        preventiveFrqMonths: tool.preventiveFrqMonths,
        purchaseDt: body.unitPurchaseDt || body.purchaseDt,
      });
    }

    // Only fill purchase date on units that still have none — never overwrite
    // an existing past/custom purchase date on every Save.
    if (body.unitPurchaseDt || body.purchaseDt) {
      const pDt = new Date(String(body.unitPurchaseDt || body.purchaseDt));
      if (!isNaN(pDt.getTime())) {
        await prisma.gaugeSerialNo.updateMany({
          where: {
            AND: [
              {
                OR: [
                  ...(tool.toolOrGaugeNo ? [{ toolOrGaugeNo: tool.toolOrGaugeNo }] : []),
                  { toolRefNo: tool.refNo },
                ],
              },
              { purchaseDt: null },
            ],
          },
          data: { purchaseDt: pDt },
        });
      }
    }

    // Seed missing unit NXT_PRE_DATE when asset + frequency are set
    if (isAssetYes(tool.isAsset) || (tool.preventiveFrqMonths ?? 0) > 0) {
      const next = computeNextPreDate({
        frequencyMonths:
          tool.preventiveFrqMonths && tool.preventiveFrqMonths > 0
            ? tool.preventiveFrqMonths
            : 6,
      });
      if (next) {
        await prisma.gaugeSerialNo.updateMany({
          where: {
            AND: [
              {
                OR: [
                  ...(tool.toolOrGaugeNo ? [{ toolOrGaugeNo: tool.toolOrGaugeNo }] : []),
                  { toolRefNo: tool.refNo },
                ],
              },
              { nextPreDate: null },
            ],
          },
          data: { nextPreDate: next },
        });
      }
    }

    return NextResponse.json({ ok: true, tool });
  } catch (error) {
    console.error("PUT /api/tools/[id] failed:", error);
    return NextResponse.json(
      {
        error: prismaWriteErrorMessage(
          error,
          error instanceof Error ? error.message.slice(0, 400) : "Failed to update tool"
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canDeleteMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  await prisma.gaugeAndTools.delete({ where: { refNo: Number(id) } });
  return NextResponse.json({ ok: true });
}
