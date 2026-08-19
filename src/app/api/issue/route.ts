import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { ToolsIssueCreateSchema } from "@/lib/validators";
import { normalizeCompanyUnit } from "@/lib/companyUnits";

function maintainsSerial(flag: string | null | undefined): boolean {
  const v = (flag ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "1" || v === "true";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search") ?? "";
  const customerOnly = searchParams.get("customerOnly") === "1";
  const movementOnly = searchParams.get("movementOnly") === "1";
  const fromDate = (searchParams.get("fromDate") ?? "").trim();
  const toDate = (searchParams.get("toDate") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Number(searchParams.get("pageSize") ?? 50));
  const skip = (page - 1) * pageSize;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openStatuses = ["Active", "OPEN", "Open", "PARTIAL"];
    const closedStatuses = ["Closed", "CLOSED", "Cancelled"];

    let statusClause: Record<string, unknown> = {};
    if (statusFilter && statusFilter !== "All") {
      const key = statusFilter.toLowerCase();
      if (key === "open") {
        statusClause = { status: { in: openStatuses } };
      } else if (key === "closed") {
        statusClause = { status: { in: closedStatuses } };
      } else if (key === "overdue") {
        statusClause = {
          status: { in: openStatuses },
          dueDate: { not: null, lt: today },
        };
      } else {
        // Exact ERP status (e.g. Active, Closed)
        statusClause = { status: statusFilter };
      }
    }

    const where = {
      AND: [
        statusClause,
        customerOnly ? { custCode: { not: null } } : {},
        movementOnly
          ? {
              OR: [
                { lines: { some: { issueToItemNo: { not: null } } } },
                { issueOption: { startsWith: "External:" } },
              ],
            }
          : {},
        fromDate ? { issueDate: { gte: new Date(fromDate) } } : {},
        toDate
          ? { issueDate: { lte: new Date(`${toDate}T23:59:59.999`) } }
          : {},
        search
          ? {
              OR: [
                { dcNo: { contains: search } },
                { receiveName: { contains: search } },
                { subCode: { contains: search } },
                { custCode: { contains: search } },
                { transportName: { contains: search } },
                { poOrderNo: { contains: search } },
                { lines: { some: { toolOrGaugeNo: { contains: search } } } },
              ],
            }
          : {},
      ],
    };

    const toolPreview = {
      select: {
        toolOrGaugeNo: true,
        name: true,
        description: true,
        type: true,
        grouping: true,
        uom: true,
        size: true,
      },
    } as const;

    const [items, total] = await Promise.all([
      prisma.gaugeToolsIssue.findMany({
        where,
        include: {
          lines: {
            include: { tool: toolPreview, toolByRef: toolPreview },
          },
        },
        orderBy: { creatDt: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.gaugeToolsIssue.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching issue records:", error);
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canCreateIssue");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = ToolsIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const {
    receiveName,
    receiveNameTwo,
    subCode,
    supCode,
    custCode,
    empId,
    issueDate,
    dueDate,
    issueOption,
    dcRefNo,
    returnable,
    transportName,
    vehicleNo,
    comments,
    lobType,
    poOrderNo,
    fromUnit,
    itemType,
    issuePurpose,
    matType,
    requisitionPending,
    reqNo,
    lines,
  } = data;

  const againstReq =
    requisitionPending === "Yes" && Boolean((reqNo ?? "").trim());
  const reqNoTrim = (reqNo ?? "").trim();
  // Keep ERP audit trail of requisition on the DC (COMMENTS max 100)
  const commentsWithReq = againstReq
    ? `Req:${reqNoTrim}${comments ? ` | ${comments}` : ""}`.slice(0, 100)
    : comments || null;
  const isInternalMovement = Boolean(fromUnit?.trim()) && lines.every((line) => Boolean(line.toUnit?.trim()));
  const isMovementRecord = isInternalMovement || (issueOption ?? "").startsWith("External:");

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const issue = await prisma.$transaction(async (tx) => {
      const toolsByNo = new Map<string, Awaited<ReturnType<typeof tx.gaugeAndTools.findUnique>>>();
      for (const line of lines) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
        });
        if (!tool) {
          throw new Error(`Tool not found: ${line.toolOrGaugeNo}`);
        }
        if (isInternalMovement) {
          const currentUnit = normalizeCompanyUnit(tool.locationName);
          const sourceUnit = normalizeCompanyUnit(fromUnit);
          if (!currentUnit || currentUnit !== sourceUnit) {
            throw new Error(
              `${line.toolOrGaugeNo} belongs to ${currentUnit ?? "no valid unit"}, not ${sourceUnit ?? fromUnit}`
            );
          }
        }
        if (isMovementRecord) {
          const activeMovement = await tx.toolsTransIssue.findFirst({
            where: {
              toolOrGaugeNo: line.toolOrGaugeNo,
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
            select: { dcNo: true },
          });
          if (activeMovement) {
            throw new Error(
              `${line.toolOrGaugeNo} is already on open movement ${activeMovement.dcNo}`
            );
          }
        }
        // ERP: stock reduces only when serial numbers are NOT maintained
        if (!isMovementRecord && !maintainsSerial(tool.serialNoGenReq) && Number(tool.qtyIn ?? 0) < line.issueQty) {
          throw new Error(
            `Insufficient stock for ${line.toolOrGaugeNo}. Available: ${tool.qtyIn ?? 0}, Requested: ${line.issueQty}`
          );
        }
        toolsByNo.set(line.toolOrGaugeNo, tool);
      }

      const dcNo = await generateDocNumber("DC", "GAUGE_TOOLS_ISSUE", "DC_NO");
      const headerReturnable = returnable === "No" ? "No" : "Yes";

      const header = await tx.gaugeToolsIssue.create({
        data: {
          dcNo,
          receiveName,
          receiveNameTwo: receiveNameTwo || null,
          subCode: subCode || null,
          supCode: supCode || null,
          custCode: custCode || null,
          empId: empId ?? 0,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          issueOption: issueOption || "SubContractor",
          dcRefNo: dcRefNo || null,
          returnable: headerReturnable,
          transportName: transportName || null,
          vehicleNo: vehicleNo || null,
          comments: commentsWithReq,
          lobType,
          poOrderNo: poOrderNo || null,
          fromUnit: fromUnit || null,
          itemType: itemType || null,
          issuePurpose: issuePurpose || null,
          matType: matType || (againstReq ? "TOOLS" : null),
          status: "Active",
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });

      let nextRowId =
        ((await tx.toolsTransIssue.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;

      for (const line of lines) {
        const tool = toolsByNo.get(line.toolOrGaugeNo);
        const partNo = (line.partNo?.trim() || line.toolOrGaugeNo).slice(0, 50);
        const price = line.price != null ? Number(line.price) : null;
        const amount = price != null ? price * line.issueQty : null;
        const lineReturnable = line.returnable === "No" ? "No" : headerReturnable;

        await tx.toolsTransIssue.create({
          data: {
            rowId: nextRowId++,
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            issueQty: line.issueQty,
            partNo,
            name: tool?.name?.slice(0, 50),
            description: tool?.description?.slice(0, 500),
            type: tool?.type?.slice(0, 50),
            groupName: tool?.grouping?.slice(0, 50),
            issueToItemNo: line.toUnit?.slice(0, 15) || null,
            uom: tool?.uom?.slice(0, 10),
            issueType: tool?.issueType?.slice(0, 25),
            issueEmpName: receiveName?.slice(0, 50),
            returnable: lineReturnable,
            machine: line.machine?.slice(0, 50) || null,
            processName: line.processName?.slice(0, 100) || null,
            remarks:
              line.remarks?.slice(0, 100) ||
              (isInternalMovement && tool?.location
                ? `Source rack/location: ${tool.location}`.slice(0, 100)
                : null),
            serialNo: line.serialNo ?? null,
            price,
            amount,
            toolRefNo: tool?.refNo,
            status: "Open",
            dueDate: new Date(dueDate),
            creatUserIdCd: erpActor,
            creatDt: new Date(),
          },
        });

        // ERP note: stock reduced only where serial numbers are NOT maintained
        if (!isMovementRecord && tool && !maintainsSerial(tool.serialNoGenReq)) {
          await tx.gaugeAndTools.update({
            where: { toolOrGaugeNo: line.toolOrGaugeNo },
            data: {
              qtyIn: { decrement: line.issueQty },
              qtyOut: { increment: line.issueQty },
              lstUpdtUserIdCd: erpActor,
            },
          });
        }

        // ERP: Tools Master unit STATUS lives on GAUGE_SERIAL_NO
        // SubContractor/Customer → VENDOR USE; Employee / in-house → INHOUSE USE
        const opt = (issueOption || "").toLowerCase();
        const unitStatus = isInternalMovement
          ? "IN MOVEMENT"
          : opt.includes("sub") || opt.includes("vendor") || opt.includes("cust")
            ? "VENDOR USE"
            : opt.startsWith("external:")
              ? "VENDOR USE"
              : "INHOUSE USE";
        try {
          if (line.serialNo != null) {
            await tx.gaugeSerialNo.updateMany({
              where: {
                toolOrGaugeNo: line.toolOrGaugeNo,
                serialNo: line.serialNo,
              },
              data: { status: unitStatus },
            });
          } else if (tool && maintainsSerial(tool.serialNoGenReq)) {
            // No serial on line — mark first available unit so Master view reflects issue
            const unit = await tx.gaugeSerialNo.findFirst({
              where: {
                toolOrGaugeNo: line.toolOrGaugeNo,
                OR: [
                  { status: null },
                  {
                    status: {
                      in: ["AVAILABLE FOR USE", "Available", "NEW PURCHASE"],
                    },
                  },
                ],
              },
              orderBy: { serialNo: "asc" },
              select: { refNo: true },
            });
            if (unit) {
              await tx.gaugeSerialNo.update({
                where: { refNo: unit.refNo },
                data: { status: unitStatus },
              });
            }
          }
        } catch (err) {
          console.warn("Serial status update on issue skipped:", err);
        }

        // A single tracked instrument physically leaves the source rack as
        // soon as an internal movement is issued. Do not assign it to the
        // destination unit until that unit posts the receive transaction.
        if (isInternalMovement && tool) {
          const destinationUnit = normalizeCompanyUnit(line.toUnit);
          await tx.gaugeAndTools.update({
            where: { refNo: tool.refNo },
            data: {
              locationName: null,
              location: null,
              area: null,
              rack: null,
              locationOutputName: destinationUnit
                ? `IN TRANSIT: ${normalizeCompanyUnit(fromUnit)} -> ${destinationUnit}`
                : "IN TRANSIT",
              lstUpdtUserIdCd: erpActor,
            },
          });
        }
      }

      // ERP Requisition Pending for Tools → Issue For Tools write-back
      if (againstReq) {
        const toNum = (v: unknown) => {
          if (v == null || v === "") return 0;
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

        const allOnReq = await tx.materialRequisitionTrans.findMany({
          where: { reqNo: reqNoTrim },
        });
        if (allOnReq.length === 0) {
          throw new Error(
            `Requisition ${reqNoTrim} not found on MATERIAL_REQUISITION_TRANS — cannot write back issue qty.`
          );
        }

        for (const line of lines) {
          const toolKey = norm(line.toolOrGaugeNo);
          const matched = allOnReq.filter((rl) => norm(rl.toolOrGaugeNo) === toolKey);
          if (matched.length === 0) {
            throw new Error(
              `No line for tool ${line.toolOrGaugeNo} on requisition ${reqNoTrim}. Check Req No and tool number.`
            );
          }

          let remaining = line.issueQty;
          const issuedNow = new Map<number, number>(); // rowId → latest ISSUE_QTY
          for (const rl of matched) {
            issuedNow.set(rl.rowId, toNum(rl.issueQty));
          }

          for (const rl of matched) {
            if (remaining <= 0) break;
            const prevIssued = issuedNow.get(rl.rowId) ?? 0;
            const reqQty = toNum(rl.reqQty);
            const openBal = reqQty > 0 ? Math.max(0, reqQty - prevIssued) : remaining;
            if (reqQty > 0 && openBal <= 0) continue;
            const apply = Math.min(remaining, openBal > 0 ? openBal : remaining);
            const newIssued = prevIssued + apply;
            const fulfilled = reqQty > 0 && newIssued >= reqQty;
            await tx.materialRequisitionTrans.update({
              where: { rowId: rl.rowId },
              data: {
                issueQty: newIssued,
                status: fulfilled ? "CLOSED" : "OPEN",
                lstUpdtUserIdCd: erpActor,
                lstUpdtTs: new Date(),
              },
            });
            issuedNow.set(rl.rowId, newIssued);
            remaining -= apply;
          }

          // Over-issue / no open balance left — park remainder on last matched line
          if (remaining > 0) {
            const rl = matched[matched.length - 1];
            const newIssued = (issuedNow.get(rl.rowId) ?? toNum(rl.issueQty)) + remaining;
            await tx.materialRequisitionTrans.update({
              where: { rowId: rl.rowId },
              data: {
                issueQty: newIssued,
                status: "CLOSED",
                lstUpdtUserIdCd: erpActor,
                lstUpdtTs: new Date(),
              },
            });
          }
        }

        const allReqLines = await tx.materialRequisitionTrans.findMany({
          where: { reqNo: reqNoTrim },
        });
        const allFulfilled =
          allReqLines.length > 0 &&
          allReqLines.every((l) => {
            const rq = toNum(l.reqQty);
            const iq = toNum(l.issueQty);
            return rq > 0 && iq >= rq;
          });
        const headerIssued = allReqLines.reduce((s, l) => s + toNum(l.issueQty), 0);
        const headerUpdated = await tx.materialRequisitionMaster.updateMany({
          where: { reqNo: reqNoTrim },
          data: {
            status: allFulfilled ? "CLOSED" : "OPEN",
            issueQty: headerIssued,
            lstUpdtUserIdCd: erpActor,
            lstUpdtTs: new Date(),
          },
        });
        if (headerUpdated.count === 0) {
          throw new Error(
            `Requisition header ${reqNoTrim} not found — line qty updated but header status was not.`
          );
        }
      }

      return header;
    });

    return NextResponse.json({ ok: true, issue }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
