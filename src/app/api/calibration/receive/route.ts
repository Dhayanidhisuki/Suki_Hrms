import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibReceiveCreateSchema } from "@/lib/validators";

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
          },
        },
      },
    });

    // Derive open issue status for UI that still expects calibIssue.status
    const mapped = items.map((item) => ({
      ...item,
      calibIssue: item.calibIssue
        ? { ...item.calibIssue, status: "CLOSED" }
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
          select: { toolOrGaugeNo: true, status: true, issueQty: true, serialNo: true },
        },
      },
    });

    if (!issue) {
      return NextResponse.json({ error: `Calibration DC #${dcNo} not found` }, { status: 400 });
    }

    const openToolNos = new Set(
      issue.inHouseLines
        .filter((l) => l.toolOrGaugeNo)
        .filter((l) => {
          const s = (l.status ?? "").toUpperCase();
          return (
            !s ||
            s === "ISSUED" ||
            s === "OPEN" ||
            s === "UNDER CALIBRATION" ||
            s.includes("ISSUE FOR CALIBRATION") ||
            s === "PENDING"
          );
        })
        .map((l) => l.toolOrGaugeNo as string)
    );

    if (openToolNos.size === 0) {
      return NextResponse.json(
        { error: `DC #${dcNo} has no open lines left to receive` },
        { status: 400 }
      );
    }

    for (const line of lines) {
      if (!openToolNos.has(line.toolOrGaugeNo)) {
        return NextResponse.json(
          {
            error: `Tool ${line.toolOrGaugeNo} is not an open line on DC #${dcNo}`,
          },
          { status: 400 }
        );
      }
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

      for (const line of lines) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
        });
        const issueLine = issue.inHouseLines.find((l) => l.toolOrGaugeNo === line.toolOrGaugeNo);
        const serialNo = line.serialNo ?? issueLine?.serialNo ?? null;
        const description =
          (line.description ?? tool?.description ?? tool?.name)?.slice(0, 50) ?? null;

        // ROW_ID is SQL Server IDENTITY — omit it (Prisma create with stale client
        // still required rowId; explicit rowId fails with IDENTITY_INSERT OFF).
        await tx.$executeRaw`
          INSERT INTO [TOOLS_TRANS_RECEIVE_FOR_CALIBRATION]
            ([REC_NO], [DC_NO], [TOOL_OR_GAUGE_NO], [DESCRIPTION], [SERIAL_NO], [QTY], [PRICE], [CREAT_DT])
          VALUES (
            ${recNo},
            ${dcNo},
            ${line.toolOrGaugeNo},
            ${description},
            ${serialNo},
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

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            status: "Available",
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
