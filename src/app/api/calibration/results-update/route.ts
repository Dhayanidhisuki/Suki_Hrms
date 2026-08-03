import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibResultsUpdateSchema } from "@/lib/validators";
import { loadCalibResultsPending } from "@/lib/calibResultsData";

/** Pending / recent calibration issue lines for results update UI */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const items = await loadCalibResultsPending(200);
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching calibration results pending:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load pending calibration results" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canManageCalibration");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = CalibResultsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { toolOrGaugeNo, result, remarks, nextCDate } = parsed.data;

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const tool = await prisma.gaugeAndTools.findUnique({
      where: { toolOrGaugeNo },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const record = await prisma.$transaction(async (tx) => {
      // Update the most recent open issue line for this tool
      const openLine = await tx.toolsTransIssueForCalibration.findFirst({
        where: {
          toolOrGaugeNo,
          OR: [
            { resultStatus: null },
            { resultStatus: "" },
            { calibrationStatus: { in: ["Pending", "PENDING", "Open", "OPEN"] } },
          ],
        },
        orderBy: { creatDt: "desc" },
      });

      if (openLine) {
        await tx.toolsTransIssueForCalibration.update({
          where: { rowId: openLine.rowId },
          data: {
            resultStatus: result,
            calibrationStatus: result === "FAILED" ? "Failed" : "Done",
            calibResultComments: remarks?.slice(0, 50) ?? result.slice(0, 50),
            calibratedBy: erpActor.slice(0, 25),
            calibratedDate: new Date(),
            nxtCalibDate: new Date(nextCDate),
            status: result === "FAILED" ? "Failed" : "Calibrated",
          },
        });
      }

      // Best-effort control card write (table may be unused / awkward PK in ERP)
      try {
        // GAUGE_CONTROL_CARD.ROW_ID is not identity in the ERP DB.
        const nextCardRowId =
          ((await tx.gaugeControlCard.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
        const controlCard = await tx.gaugeControlCard.upsert({
          where: { toolOrGaugeNo: toolOrGaugeNo.slice(0, 15) },
          update: {
            status: result === "FAILED" ? "Out of Service" : "Active",
          },
          create: {
            rowId: nextCardRowId,
            toolOrGaugeNo: toolOrGaugeNo.slice(0, 15),
            type: (tool.type ?? "General").slice(0, 25),
            status: result === "FAILED" ? "Out of Service" : "Active",
            frequency: String(tool.calibrationFrqMonths ?? 6).slice(0, 15),
            creatDt: new Date(),
          },
        });

        await tx.gaugeControlCardTrans.create({
          data: {
            refNo: controlCard.rowId,
            cDate: new Date(),
            nextCDate: new Date(nextCDate),
            remarks: (remarks ? `${result}: ${remarks}` : result).slice(0, 25),
            creatDt: new Date(),
            creatUserIdCd: erpActor,
          },
        });
      } catch (err) {
        console.warn("GaugeControlCard write skipped:", err);
      }

      await tx.gaugeAndTools.update({
        where: { toolOrGaugeNo },
        data: {
          status: result === "FAILED" ? "Out of Service" : "Available",
          lstUpdtUserIdCd: erpActor,
        },
      });

      return { toolOrGaugeNo, result, nextCDate, updatedLineId: openLine?.rowId ?? null };
    });

    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
