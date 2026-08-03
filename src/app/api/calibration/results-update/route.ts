import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibResultsUpdateSchema } from "@/lib/validators";
import { loadCalibResultsPending } from "@/lib/calibResultsData";

function normalizeResult(result: string): {
  resultStatus: string;
  failed: boolean;
  toolStatus: string;
  calibStatus: string;
  lineStatus: string;
} {
  const upper = result.toUpperCase();
  if (upper === "FAILED" || upper === "OUT OF SERVICE") {
    return {
      resultStatus: upper === "OUT OF SERVICE" ? "OUT OF SERVICE" : "FAILED",
      failed: true,
      toolStatus: "Out of Service",
      calibStatus: "Failed",
      lineStatus: "Failed",
    };
  }
  if (upper === "AVAILABLE FOR USE" || upper === "PASSED") {
    return {
      resultStatus: upper === "AVAILABLE FOR USE" ? "AVAILABLE FOR USE" : "PASSED",
      failed: false,
      toolStatus: "Available",
      calibStatus: "Done",
      lineStatus: "Calibrated",
    };
  }
  // RECALIBRATED
  return {
    resultStatus: "RECALIBRATED",
    failed: false,
    toolStatus: "Available",
    calibStatus: "Done",
    lineStatus: "Calibrated",
  };
}

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

  const {
    toolOrGaugeNo,
    result,
    remarks,
    nextCDate,
    calibratedDate,
    calibratedBy,
    certificateNo,
    referenceStandard,
    errorNoticed,
    comments,
    location,
    locationName,
  } = parsed.data;

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);
    const normalized = normalizeResult(result);

    const tool = await prisma.gaugeAndTools.findUnique({
      where: { toolOrGaugeNo },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Pack ERP-style free text into short ERP columns
    const commentParts = [
      certificateNo ? `Cert:${certificateNo}` : null,
      referenceStandard ? `Std:${referenceStandard}` : null,
      errorNoticed ? `Err:${errorNoticed}` : null,
      comments || remarks || null,
    ].filter(Boolean) as string[];
    const packedComments = commentParts.join(" | ").slice(0, 50);
    const packedRemarks = (certificateNo || remarks || comments || result).slice(0, 50);
    const byWhom = (calibratedBy?.trim() || erpActor).slice(0, 25);
    const calibDt = calibratedDate ? new Date(calibratedDate) : new Date();

    const record = await prisma.$transaction(async (tx) => {
      const openLine = await tx.toolsTransIssueForCalibration.findFirst({
        where: {
          toolOrGaugeNo,
          OR: [
            { resultStatus: null },
            { resultStatus: "" },
            { calibrationStatus: { in: ["Pending", "PENDING", "Open", "OPEN"] } },
            { status: { in: ["Received", "Issued", "Under Calibration", "ISSUE FOR CALIBRATION"] } },
          ],
        },
        orderBy: { creatDt: "desc" },
      });

      if (openLine) {
        await tx.toolsTransIssueForCalibration.update({
          where: { rowId: openLine.rowId },
          data: {
            resultStatus: normalized.resultStatus.slice(0, 30),
            calibrationStatus: normalized.calibStatus,
            calibResultComments: packedComments || normalized.resultStatus.slice(0, 50),
            calibratedBy: byWhom,
            calibratedDate: calibDt,
            nxtCalibDate: new Date(nextCDate),
            remarks: packedRemarks,
            status: normalized.lineStatus.slice(0, 30),
          },
        });
      }

      try {
        const nextCardRowId =
          ((await tx.gaugeControlCard.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
        const controlCard = await tx.gaugeControlCard.upsert({
          where: { toolOrGaugeNo: toolOrGaugeNo.slice(0, 15) },
          update: {
            status: normalized.failed ? "Out of Service" : "Active",
          },
          create: {
            rowId: nextCardRowId,
            toolOrGaugeNo: toolOrGaugeNo.slice(0, 15),
            type: (tool.type ?? "General").slice(0, 25),
            status: normalized.failed ? "Out of Service" : "Active",
            frequency: String(tool.calibrationFrqMonths ?? 6).slice(0, 15),
            creatDt: new Date(),
            creatUserIdCd: erpActor,
          },
        });

        await tx.gaugeControlCardTrans.create({
          data: {
            refNo: controlCard.rowId,
            cDate: calibDt,
            nextCDate: new Date(nextCDate),
            remarks: (certificateNo || packedComments || normalized.resultStatus).slice(0, 25),
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
          status: normalized.toolStatus,
          ...(location !== undefined
            ? {
                location: location?.trim() ? location.trim().slice(0, 50) : null,
                locationName: locationName?.trim()
                  ? locationName.trim().slice(0, 100)
                  : location?.trim()
                    ? location.trim().slice(0, 100)
                    : null,
              }
            : {}),
          lstUpdtUserIdCd: erpActor,
        },
      });

      return { toolOrGaugeNo, result: normalized.resultStatus, nextCDate, updatedLineId: openLine?.rowId ?? null };
    });

    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
