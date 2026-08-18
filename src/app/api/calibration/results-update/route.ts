import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibResultsUpdateSchema } from "@/lib/validators";
import { loadCalibResultsPending, loadCalibResultsClosed } from "@/lib/calibResultsData";

function normalizeResult(result: string): {
  resultStatus: string;
  failed: boolean;
  toolStatus: string;
  calibStatus: string;
  lineStatus: string;
} {
  const upper = result.toUpperCase().trim();
  // Failed / out-of-service family (ERP + legacy)
  if (
    upper === "FAILED" ||
    upper === "OUT OF SERVICE" ||
    upper === "WORN OUT" ||
    upper === "BROKEN" ||
    upper === "REJECTED" ||
    upper === "NOT IN USE"
  ) {
    return {
      resultStatus: upper.slice(0, 30),
      failed: true,
      toolStatus: upper === "NOT IN USE" ? "Not In Use" : "Out of Service",
      calibStatus: "Failed",
      lineStatus: upper.slice(0, 30),
    };
  }
  // Fit for use family (ERP AVAILABLE FOR USE + legacy PASSED)
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
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
    const openClosed = (req.nextUrl.searchParams.get("openClosed") ?? "open").toLowerCase();
    const fromDue = (req.nextUrl.searchParams.get("fromDue") ?? "").trim();
    const toDue = (req.nextUrl.searchParams.get("toDue") ?? "").trim();
    const take = Math.min(500, Number(req.nextUrl.searchParams.get("take") ?? 200));

    let items = await loadCalibResultsPending(take);

    if (openClosed === "closed") {
      items = await loadCalibResultsClosed(take);
    } else if (openClosed === "all") {
      const closed = await loadCalibResultsClosed(take);
      items = [...items, ...closed];
    }

    if (fromDue) {
      const from = new Date(fromDue).getTime();
      items = items.filter((i) => {
        if (!i.calibDueDate) return false;
        return new Date(i.calibDueDate).getTime() >= from;
      });
    }
    if (toDue) {
      const to = new Date(`${toDue}T23:59:59.999`).getTime();
      items = items.filter((i) => {
        if (!i.calibDueDate) return false;
        return new Date(i.calibDueDate).getTime() <= to;
      });
    }
    if (search) {
      items = items.filter((i) => {
        const blob = [
          i.toolOrGaugeNo,
          i.name,
          i.type,
          i.receiveName,
          String(i.dcNo ?? ""),
          i.remarks,
          i.issueFor,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(search);
      });
    }

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
    observedSpecs,
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

    const obsPacked =
      observedSpecs && observedSpecs.length > 0
        ? observedSpecs
            .filter((o) => o.obsMin || o.obsMax || o.note)
            .map((o) => `${o.parameter}:${o.obsMin ?? ""}-${o.obsMax ?? ""}`)
            .join(";")
            .slice(0, 50)
        : null;

    // Pack ERP-style free text into short ERP columns
    const commentParts = [
      certificateNo ? `Cert:${certificateNo}` : null,
      referenceStandard ? `Std:${referenceStandard}` : null,
      errorNoticed ? `Err:${errorNoticed}` : null,
      obsPacked ? `Obs:${obsPacked}` : null,
      comments || remarks || null,
    ].filter(Boolean) as string[];
    const packedComments = commentParts.join(" | ").slice(0, 50);
    const packedRemarks = (obsPacked || certificateNo || remarks || comments || result).slice(0, 50);
    const masterObservationRemark = (errorNoticed?.trim() || obsPacked || "").slice(0, 50);
    const byWhom = (calibratedBy?.trim() || erpActor).slice(0, 25);
    const calibDt = calibratedDate ? new Date(calibratedDate) : new Date();

    const record = await prisma.$transaction(async (tx) => {
      const openLine = await tx.toolsTransIssueForCalibration.findFirst({
        where: {
          toolOrGaugeNo,
          status: { in: ["Received", "RECEIVED"] },
          OR: [
            { resultStatus: null },
            { resultStatus: "" },
            { calibrationStatus: { in: ["Pending", "PENDING", "Open", "OPEN"] } },
          ],
        },
        orderBy: { creatDt: "desc" },
        include: { calibIssue: { select: { receiveName: true } } },
      });

      if (!openLine) {
        throw new Error("Receive this instrument against its calibration DC before recording results");
      }

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

      const detail = await tx.calibrationResultDetail.upsert({
        where: { issueLineRowId: openLine.rowId },
        update: {
          resultStatus: normalized.resultStatus,
          certificateNo: certificateNo?.trim() || null,
          referenceStandard: referenceStandard?.trim() || null,
          errorNoticed: errorNoticed?.trim() || null,
          comments: comments?.trim() || remarks?.trim() || null,
          calibratedBy: calibratedBy?.trim() || byWhom,
          calibratedDate: calibDt,
          nextCalibDate: new Date(nextCDate),
          location: locationName?.trim() || location?.trim() || null,
          updatedBy: erpActor,
          observations: {
            deleteMany: {},
            create: (observedSpecs ?? []).map((item, index) => ({
              lineNo: index + 1,
              parameter: item.parameter,
              specification: item.specification?.trim() || null,
              observedMin: item.obsMin?.trim() || null,
              observedMax: item.obsMax?.trim() || null,
              gaugeStatus: item.gaugeStatus?.trim() || normalized.resultStatus,
              remarks: item.note?.trim() || null,
            })),
          },
        },
        create: {
          issueLineRowId: openLine.rowId,
          toolOrGaugeNo,
          dcNo: openLine.dcNo,
          serialNo: openLine.serialNo,
          resultStatus: normalized.resultStatus,
          certificateNo: certificateNo?.trim() || null,
          referenceStandard: referenceStandard?.trim() || null,
          errorNoticed: errorNoticed?.trim() || null,
          comments: comments?.trim() || remarks?.trim() || null,
          calibratedBy: calibratedBy?.trim() || byWhom,
          calibratedDate: calibDt,
          nextCalibDate: new Date(nextCDate),
          location: locationName?.trim() || location?.trim() || null,
          createdBy: erpActor,
          updatedBy: erpActor,
          observations: {
            create: (observedSpecs ?? []).map((item, index) => ({
              lineNo: index + 1,
              parameter: item.parameter,
              specification: item.specification?.trim() || null,
              observedMin: item.obsMin?.trim() || null,
              observedMax: item.obsMax?.trim() || null,
              gaugeStatus: item.gaugeStatus?.trim() || normalized.resultStatus,
              remarks: item.note?.trim() || null,
            })),
          },
        },
      });

      // Keep structured deviations synchronized with the current result edit.
      // Re-saving the result replaces only deviations generated for this issue
      // line, preventing duplicate history rows.
      await tx.calibrationDeviation.deleteMany({
        where: { issueLineRowId: openLine.rowId },
      });
      const deviationRows = (observedSpecs ?? [])
        .filter((item) => {
          const status = (item.gaugeStatus || normalized.resultStatus).toUpperCase();
          return normalized.failed || /FAIL|REJECT|BROKEN|WORN|ATTENTION|OUT OF SERVICE/.test(status);
        })
        .map((item) => ({
          resultId: detail.id,
          issueLineRowId: openLine.rowId,
          toolOrGaugeNo,
          parameter: item.parameter.slice(0, 100),
          expectedValue: item.specification?.trim().slice(0, 100) || null,
          observedValue: [item.obsMin, item.obsMax].filter(Boolean).join(" – ").slice(0, 100) || null,
          deviation: (item.note?.trim() || errorNoticed?.trim() || normalized.resultStatus).slice(0, 200),
          permissibleLimit: item.specification?.trim().slice(0, 100) || null,
          resultStatus: normalized.failed ? "Fail" : "Attention",
          correctiveAction: comments?.trim().slice(0, 1000) || remarks?.trim().slice(0, 1000) || null,
          recordedBy: erpActor,
        }));
      if (deviationRows.length === 0 && (normalized.failed || errorNoticed?.trim())) {
        deviationRows.push({
          resultId: detail.id,
          issueLineRowId: openLine.rowId,
          toolOrGaugeNo,
          parameter: "General",
          expectedValue: null,
          observedValue: null,
          deviation: (errorNoticed?.trim() || normalized.resultStatus).slice(0, 200),
          permissibleLimit: null,
          resultStatus: normalized.failed ? "Fail" : "Attention",
          correctiveAction: comments?.trim().slice(0, 1000) || remarks?.trim().slice(0, 1000) || null,
          recordedBy: erpActor,
        });
      }
      if (deviationRows.length > 0) {
        await tx.calibrationDeviation.createMany({ data: deviationRows });
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

        const nextCardTransRowId =
          ((await tx.gaugeControlCardTrans.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
        await tx.gaugeControlCardTrans.create({
          data: {
            rowId: nextCardTransRowId,
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
          ...(masterObservationRemark ? { remarks: masterObservationRemark } : {}),
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

      const masterObservedError = (errorNoticed?.trim() || obsPacked || null)?.slice(0, 200) ?? null;
      const calibrationAgency = openLine.calibIssue?.receiveName?.trim().slice(0, 100) || null;
      const updatedImported = await tx.$executeRaw`
        UPDATE [dbo].[TOOLS_APP_INSTRUMENT_MASTER_DATA]
        SET [CALIBRATION_DATE] = ${calibDt},
            [NEXT_CALIBRATION_DUE] = ${new Date(nextCDate)},
            [OBSERVED_ERROR] = ${masterObservedError},
            [CALIBRATION_AGENCY] = ${calibrationAgency},
            [UPDATED_AT] = ${new Date()}
        WHERE [REF_NO] = ${tool.refNo}
      `;
      if (updatedImported === 0) {
        await tx.$executeRaw`
          INSERT INTO [dbo].[TOOLS_APP_INSTRUMENT_MASTER_DATA]
            ([REF_NO], [CALIBRATION_DATE], [NEXT_CALIBRATION_DUE], [OBSERVED_ERROR], [CALIBRATION_AGENCY], [UPDATED_AT])
          VALUES
            (${tool.refNo}, ${calibDt}, ${new Date(nextCDate)}, ${masterObservedError}, ${calibrationAgency}, ${new Date()})
        `;
      }

      if (normalized.failed) {
        const activeDefect = await tx.instrumentDefect.findFirst({
          where: {
            refNo: tool.refNo,
            status: { notIn: ["Returned to Use", "Rejected", "Scrapped", "Closed"] },
          },
          select: { id: true },
        });
        if (!activeDefect) {
          await tx.instrumentDefect.create({
            data: {
              refNo: tool.refNo,
              toolOrGaugeNo,
              unitCode: tool.locationName?.slice(0, 100) || null,
              reportedDate: calibDt,
              defectDetails: `Calibration result: ${normalized.resultStatus}`,
              errorDeviation: (errorNoticed?.trim() || packedComments || null)?.slice(0, 500) ?? null,
              status: "Defect Reported",
              reportedBy: erpActor,
            },
          });
        }
      }

      // ERP unit grid STATUS — result must clear ISSUE FOR CALIBRATION on GAUGE_SERIAL_NO
      // (lifecycle panel reads resultStatus; unit table reads serial.status — keep them in sync)
      const unitStatus = normalized.failed
        ? normalized.resultStatus.slice(0, 30)
        : "AVAILABLE FOR USE";
      const serialWhereBase = {
        OR: [
          { toolOrGaugeNo },
          ...(tool.refNo != null ? [{ toolRefNo: tool.refNo }] : []),
        ],
      };
      const calibPipelineStatuses = [
        "ISSUE FOR CALIBRATION",
        "Under Calibration",
        "UNDER CALIBRATION",
        "Received",
        "RECEIVED",
        "Issued",
        "ISSUED",
      ];
      try {
        const sn = openLine?.serialNo ?? null;
        let updatedCount = 0;
        if (sn != null) {
          const bySn = await tx.gaugeSerialNo.updateMany({
            where: { AND: [serialWhereBase, { serialNo: sn }] },
            data: { status: unitStatus },
          });
          updatedCount = bySn.count;
        }
        if (updatedCount === 0) {
          const byPipeline = await tx.gaugeSerialNo.updateMany({
            where: {
              AND: [serialWhereBase, { status: { in: calibPipelineStatuses } }],
            },
            data: { status: unitStatus },
          });
          updatedCount = byPipeline.count;
        }
        // Single-unit tools: always sync the only serial even if status text differed
        if (updatedCount === 0) {
          const units = await tx.gaugeSerialNo.findMany({
            where: serialWhereBase,
            select: { refNo: true },
            take: 2,
          });
          if (units.length === 1) {
            await tx.gaugeSerialNo.update({
              where: { refNo: units[0].refNo },
              data: { status: unitStatus },
            });
          }
        }
      } catch (err) {
        console.warn("Serial status update on results skipped:", err);
      }

      return { toolOrGaugeNo, result: normalized.resultStatus, nextCDate, updatedLineId: openLine?.rowId ?? null };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
