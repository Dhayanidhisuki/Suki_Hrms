import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibReceiveCreateSchema } from "@/lib/validators";

function isCalibIssueLineOpen(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return (
    !s ||
    s === "ISSUED" ||
    s === "OPEN" ||
    s === "UNDER CALIBRATION" ||
    s.includes("ISSUE FOR CALIBRATION") ||
    s === "PENDING"
  );
}

function isCalibIssueLineReceived(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "RECEIVED" || s === "CLOSED" || s.includes("RECEIVED");
}

function deriveIssueStatus(lines: { status: string | null }[]): "OPEN" | "PARTIAL" | "CLOSED" {
  if (lines.length === 0) return "CLOSED";
  const openCount = lines.filter((l) => isCalibIssueLineOpen(l.status)).length;
  const receivedCount = lines.filter((l) => isCalibIssueLineReceived(l.status)).length;
  if (openCount === 0) return "CLOSED";
  if (receivedCount > 0 && openCount > 0) return "PARTIAL";
  return "OPEN";
}

async function resolveLabPrice(
  toolRefNo: number | null | undefined,
  toolPrice: unknown,
  clientPrice: number
): Promise<number> {
  if (Number.isFinite(clientPrice) && clientPrice > 0) return clientPrice;

  if (toolRefNo != null) {
    try {
      const pm = await prisma.toolsPriceMaster.findFirst({
        where: { toolRefNo },
        orderBy: [{ revDate: "desc" }, { creatDt: "desc" }],
        select: { rate: true },
      });
      if (pm?.rate != null) {
        const rate = Number(pm.rate);
        if (Number.isFinite(rate) && rate > 0) return rate;
      }
    } catch (err) {
      console.warn("Price master lookup skipped:", err);
    }
  }

  const master = Number(toolPrice);
  if (Number.isFinite(master) && master > 0) return master;
  return 0;
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const items = await prisma.toolsReceiveForCalibration.findMany({
      orderBy: { creatDt: "desc" },
      take: 200,
      include: {
        lines: { include: { tool: true } },
        calibIssue: {
          select: {
            dcNo: true,
            receiveName: true,
            subCode: true,
            issueDate: true,
            issueFor: true,
            inHouseLines: { select: { status: true } },
          },
        },
      },
    });

    const mapped = items.map((item) => ({
      ...item,
      calibIssue: item.calibIssue
        ? {
            dcNo: item.calibIssue.dcNo,
            receiveName: item.calibIssue.receiveName,
            subCode: item.calibIssue.subCode,
            issueDate: item.calibIssue.issueDate,
            issueFor: item.calibIssue.issueFor,
            status: deriveIssueStatus(item.calibIssue.inHouseLines ?? []),
          }
        : null,
    }));

    return NextResponse.json({ items: mapped, total: mapped.length });
  } catch (error) {
    console.error("Error fetching calibration receives:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load calibration receives" },
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
  const parsed = CalibReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { dcNo, receiveDate, partyDcNo, receiverName, lines } = parsed.data;

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const issue = await prisma.toolsIssueForCalibration.findUnique({
      where: { dcNo },
      include: {
        inHouseLines: {
          select: {
            toolOrGaugeNo: true,
            status: true,
            issueQty: true,
            serialNo: true,
            toolRefNo: true,
          },
        },
      },
    });

    if (!issue) {
      return NextResponse.json({ error: `Calibration DC #${dcNo} not found` }, { status: 400 });
    }

    const openLines = issue.inHouseLines.filter((l) =>
      isCalibIssueLineOpen(l.status)
    );
    const openToolNos = new Set(
      openLines.filter((l) => l.toolOrGaugeNo).map((l) => l.toolOrGaugeNo as string)
    );

    if (openToolNos.size === 0) {
      return NextResponse.json(
        { error: `DC #${dcNo} has no open lines left to receive` },
        { status: 400 }
      );
    }

    // Resolve qty/price/serial before the transaction so validation errors are clear
    const normalizedLines: Array<{
      toolOrGaugeNo: string;
      qty: number;
      price: number;
      serialNo: number | null;
      description: string | null;
    }> = [];

    for (const line of lines) {
      if (!openToolNos.has(line.toolOrGaugeNo)) {
        return NextResponse.json(
          {
            error: `Tool ${line.toolOrGaugeNo} is not an open line on DC #${dcNo}`,
          },
          { status: 400 }
        );
      }

      const issueLine = openLines.find((l) => l.toolOrGaugeNo === line.toolOrGaugeNo);
      const issuedQty = Math.max(1, Number(issueLine?.issueQty) || 1);
      let qty = Number(line.qty);
      if (!Number.isFinite(qty) || qty < 1) qty = issuedQty;
      if (qty > issuedQty) {
        return NextResponse.json(
          {
            error: `Qty ${qty} for ${line.toolOrGaugeNo} exceeds issued qty ${issuedQty}`,
          },
          { status: 400 }
        );
      }

      const tool = await prisma.gaugeAndTools.findUnique({
        where: { toolOrGaugeNo: line.toolOrGaugeNo },
        select: { price: true, description: true, name: true, refNo: true },
      });

      const price = await resolveLabPrice(
        issueLine?.toolRefNo ?? tool?.refNo,
        tool?.price,
        Number(line.price)
      );

      const serialNo = line.serialNo ?? issueLine?.serialNo ?? null;
      const description =
        (line.description ?? tool?.description ?? tool?.name)?.slice(0, 50) ?? null;

      normalizedLines.push({
        toolOrGaugeNo: line.toolOrGaugeNo,
        qty,
        price,
        serialNo,
        description,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const header = await tx.toolsReceiveForCalibration.create({
        data: {
          dcNo,
          receiveDate: new Date(receiveDate),
          partyDcNo: partyDcNo?.trim()?.slice(0, 20) || null,
          receiverName: receiverName?.trim()?.slice(0, 30) || null,
          vendorCd: issue.subCode?.slice(0, 20) || null,
          status: "Received",
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });

      const recNo = header.recNo;

      for (const line of normalizedLines) {
        await tx.$executeRaw`
          INSERT INTO [TOOLS_TRANS_RECEIVE_FOR_CALIBRATION]
            ([REC_NO], [DC_NO], [TOOL_OR_GAUGE_NO], [DESCRIPTION], [SERIAL_NO], [QTY], [PRICE], [CREAT_DT])
          VALUES (
            ${recNo},
            ${dcNo},
            ${line.toolOrGaugeNo},
            ${line.description},
            ${line.serialNo},
            ${line.qty},
            ${line.price},
            ${new Date()}
          )
        `;

        // Mark matching open issue lines as received (certificate/result still via Results Update)
        await tx.toolsTransIssueForCalibration.updateMany({
          where: {
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
          },
          data: {
            status: "Received",
            calibrationStatus: "Pending",
          },
        });

        // Keep tool Under Calibration until Results Update posts pass/fail
        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            status: "Under Calibration",
            lstUpdtUserIdCd: erpActor,
          },
        });
      }

      return header;
    });

    return NextResponse.json({ ok: true, item: result, header: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
