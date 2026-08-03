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

function normalizeSerialFlag(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? "Y" : "N";
  const text = String(value).trim().toUpperCase();
  if (text === "YES" || text === "Y") return "Y";
  if (text === "NO" || text === "N") return "N";
  return String(value).slice(0, 5);
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
      specifications: true,
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

  const unitHistory = await buildToolUnitHistory({
    refNo: tool.refNo,
    toolOrGaugeNo: tool.toolOrGaugeNo,
  });

  const computedStatus = computeToolRollupStatus(
    tool.serialNumbers.map((s) => s.status),
    tool.activeItem
  );

  return NextResponse.json({ tool: { ...tool, unitHistory, computedStatus } });
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
      data: {
        ...updateData,
        ...(touchedLocation ? normalized : {}),
        ...(updateData.type !== undefined
          ? { type: stripPlaceholder(updateData.type) ?? null }
          : {}),
        ...(updateData.description !== undefined
          ? { description: stripPlaceholder(updateData.description) ?? null }
          : {}),
        ...(serialNoGenReq !== undefined
          ? { serialNoGenReq: normalizeSerialFlag(serialNoGenReq) }
          : {}),
        lstUpdtUserIdCd: erpActor,
      },
    });

    if (specifications) {
      await prisma.toolsSpecification.deleteMany({ where: { toolRefNo: refNo } });
      const rows = specifications
        .map((s) => ({
          toolRefNo: refNo,
          parameter: s.parameter || s.specName || "",
          specification: s.specification || s.specValue,
          minRange: s.minRange || s.unit,
          maxRange: s.maxRange,
        }))
        .filter((s) => s.parameter);
      if (rows.length > 0) {
        const maxRow =
          (await prisma.toolsSpecification.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0;
        await prisma.toolsSpecification.createMany({
          data: rows.map((row, i) => ({ ...row, rowId: maxRow + i + 1 })),
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
        error:
          error instanceof Error ? error.message.slice(0, 400) : "Failed to update tool",
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
