import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { buildToolUnitHistory } from "@/lib/toolUnitHistory";
import { computeNextPreDate, isAssetYes } from "@/lib/preventiveFlow";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const refNo = Number(id);
  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo } });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const unitHistory = await buildToolUnitHistory({
    refNo: tool.refNo,
    toolOrGaugeNo: tool.toolOrGaugeNo,
  });

  return NextResponse.json({
    serials: unitHistory,
    unitHistory,
  });
}

export async function POST(
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
  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo } });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }
  if (!tool.toolOrGaugeNo) {
    return NextResponse.json(
      { error: "Tool must have TOOL_OR_GAUGE_NO before units can be added" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const make = typeof body.make === "string" ? body.make.trim().slice(0, 50) : "";
  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim().slice(0, 30)
      : "AVAILABLE FOR USE";

  let serialNo: number | null = null;
  if (body.serialNo !== undefined && body.serialNo !== null && body.serialNo !== "") {
    const n = Number(body.serialNo);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "SERIAL_NO must be a positive integer" }, { status: 400 });
    }
    serialNo = n;
  }

  let purchaseDt: Date | null = null;
  if (body.purchaseDt) {
    const d = new Date(String(body.purchaseDt));
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Purchase date is invalid" }, { status: 400 });
    }
    purchaseDt = d;
  }

  let nextPreDate: Date | null = null;
  if (body.nextPreDate) {
    const d = new Date(String(body.nextPreDate));
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Next PreMNT date is invalid" }, { status: 400 });
    }
    nextPreDate = d;
  } else if (isAssetYes(tool.isAsset) || (tool.preventiveFrqMonths ?? 0) > 0) {
    // Auto-seed from master frequency when adding a unit to an asset
    nextPreDate = computeNextPreDate({
      frequencyMonths: tool.preventiveFrqMonths && tool.preventiveFrqMonths > 0
        ? tool.preventiveFrqMonths
        : 6,
    });
  }

  const existingForTool = await prisma.gaugeSerialNo.findMany({
    where: {
      OR: [{ toolOrGaugeNo: tool.toolOrGaugeNo }, { toolRefNo: tool.refNo }],
    },
    select: { serialNo: true },
  });

  if (serialNo == null) {
    const maxExisting = existingForTool.reduce(
      (max, s) => Math.max(max, s.serialNo ?? 0),
      0
    );
    serialNo = maxExisting + 1;
  } else if (existingForTool.some((s) => s.serialNo === serialNo)) {
    return NextResponse.json(
      { error: `SERIAL_NO ${serialNo} already exists for this tool` },
      { status: 409 }
    );
  }

  const nextRef =
    ((await prisma.gaugeSerialNo.aggregate({ _max: { refNo: true } }))._max.refNo ?? 0) + 1;

  // CREAT_USER_ID_CD FK → ERP_USER.USER_ID (app username e.g. "admin" is not an ERP user)
  let erpActor: string;
  try {
    erpActor = await resolveErpAuditUserId(authCheck.session);
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

  let created;
  try {
    created = await prisma.gaugeSerialNo.create({
      data: {
        refNo: nextRef,
        toolRefNo: tool.refNo,
        serialNo,
        status,
        make: make || null,
        purchaseDt,
        nextPreDate,
        creatUserIdCd: erpActor,
        creatDt: new Date(),
        // Relation connect — scalar toolOrGaugeNo is not accepted on checked CreateInput
        tool: { connect: { toolOrGaugeNo: tool.toolOrGaugeNo } },
      },
    });
  } catch (err) {
    console.error("POST /api/tools/[id]/serials failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message.replace(/^Invalid `[^`]+` invocation:\s*/, "").trim().slice(0, 300) ||
              "Failed to add physical unit"
            : "Failed to add physical unit",
      },
      { status: 500 }
    );
  }

  // Keep master qty roughly in sync when adding a unit
  const unitCount = existingForTool.length + 1;
  await prisma.gaugeAndTools.update({
    where: { refNo: tool.refNo },
    data: {
      totQty: unitCount,
      qtyIn: unitCount,
      serialNoGenReq: "Y",
      lstUpdtUserIdCd: erpActor,
    },
  });

  const unitHistory = await buildToolUnitHistory({
    refNo: tool.refNo,
    toolOrGaugeNo: tool.toolOrGaugeNo,
  });

  return NextResponse.json(
    { ok: true, serial: created, unitHistory },
    { status: 201 }
  );
}
