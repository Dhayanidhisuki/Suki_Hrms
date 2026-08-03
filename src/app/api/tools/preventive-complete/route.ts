import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { z } from "zod";
import { computeNextPreDate, isAssetYes } from "@/lib/preventiveFlow";

const CompleteSchema = z.object({
  unitRefNo: z.number().int().positive(),
  /** Optional override for next due; default = today + tool preventive frequency */
  nextPreDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  remarks: z.string().max(100).optional(),
});

/**
 * POST /api/tools/preventive-complete
 * Mark a physical unit's preventive MNT done and advance NXT_PRE_DATE.
 * Flow lives on the tool/unit — no dedicated PM module screens.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = CompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { unitRefNo, nextPreDate: nextOverride, remarks } = parsed.data;

  const unit = await prisma.gaugeSerialNo.findUnique({ where: { refNo: unitRefNo } });
  if (!unit) {
    return NextResponse.json({ error: "Physical unit not found" }, { status: 404 });
  }

  const tool = await prisma.gaugeAndTools.findFirst({
    where: {
      OR: [
        ...(unit.toolOrGaugeNo ? [{ toolOrGaugeNo: unit.toolOrGaugeNo }] : []),
        ...(unit.toolRefNo ? [{ refNo: unit.toolRefNo }] : []),
      ],
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Parent tool not found for unit" }, { status: 404 });
  }

  if (!isAssetYes(tool.isAsset) && !(tool.preventiveFrqMonths && tool.preventiveFrqMonths > 0)) {
    return NextResponse.json(
      {
        error:
          "Tool is not set up for Preventive MNT (set Is Asset = Yes and frequency on Item/Asset Master)",
      },
      { status: 400 }
    );
  }

  const freq = tool.preventiveFrqMonths ?? 0;
  const next =
    nextOverride != null
      ? new Date(nextOverride)
      : computeNextPreDate({ frequencyMonths: freq > 0 ? freq : 6 });

  if (!next || Number.isNaN(next.getTime())) {
    return NextResponse.json({ error: "Could not compute next preventive date" }, { status: 400 });
  }

  const updated = await prisma.gaugeSerialNo.update({
    where: { refNo: unitRefNo },
    data: {
      nextPreDate: next,
      nextPreDone: 1,
      // Keep unit usable after PM complete
      status: unit.status && /out of service/i.test(unit.status)
        ? "AVAILABLE FOR USE"
        : unit.status ?? "AVAILABLE FOR USE",
    },
  });

  // Best-effort stamp on latest open calib-trans PM columns (ERP stores them there too)
  try {
    if (tool.toolOrGaugeNo) {
      await prisma.$executeRaw`
        UPDATE TOP (1) TOOLS_TRANS_ISSUE_FOR_CALIBRATION
        SET PREVENTIVE_DATE = GETDATE(),
            NXT_PREVENTIVE_DATE = ${next},
            PREVENTIVE_DONE = 1,
            LST_UPDT_TS = GETDATE()
        WHERE TOOL_OR_GAUGE_NO = ${tool.toolOrGaugeNo}
           OR TOOL_REF_NO = ${tool.refNo}
      `;
    }
  } catch (err) {
    console.warn("Calib-line preventive stamp skipped:", err);
  }

  return NextResponse.json({
    ok: true,
    unit: updated,
    nextPreDate: next.toISOString().split("T")[0],
    frequencyMonths: freq,
    remarks: remarks ?? null,
    toolOrGaugeNo: tool.toolOrGaugeNo,
  });
}
