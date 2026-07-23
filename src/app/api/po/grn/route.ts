import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
import { PoReceiveCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const items = await prisma.toolsPoReceive.findMany({
    orderBy: { creatDt: "desc" },
    include: { lines: true, supplier: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canRaisePO");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = PoReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { poRef, supCode, grnDate, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const grnNo = await generateDocNumber("GRN", "TOOLS_PO_RECEIVE", "GRN_NO");

      const grn = await tx.toolsPoReceive.create({
        data: {
          grnNo,
          poRef,
          supCode,
          grnDate: new Date(grnDate),
          status: "Posted",
          creatUserIdCd: authCheck.session.userId,
        },
      });

      for (const line of lines) {
        const pending = line.poQty - line.receivedQty;

        await tx.toolsPoReceiveTrans.create({
          data: {
            grnNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            poQty: line.poQty,
            receivedQty: line.receivedQty,
            pendingQty: pending,
            unitRate: line.unitRate,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            qtyNew: { increment: line.receivedQty },
            totQty: { increment: line.receivedQty },
            qtyIn: { increment: line.receivedQty },
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });

        await tx.toolsPriceMaster.create({
          data: {
            toolOrGaugeNo: line.toolOrGaugeNo,
            effectiveDate: new Date(grnDate),
            supCode,
            unitRate: line.unitRate,
            grnNo,
            creatUserIdCd: authCheck.session.userId,
          },
        });

        await tx.toolsPoSchTrans.updateMany({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            receivedQty: { increment: line.receivedQty },
          },
        });
      }

      const affectedSchedules = await tx.toolsPoSchMaster.findMany({
        where: { poRef },
        include: { lines: true },
      });

      for (const sch of affectedSchedules) {
        const allComplete = sch.lines.every((l) => l.receivedQty >= l.expectedQty);
        const anyReceived = sch.lines.some((l) => l.receivedQty > 0);
        const overallStatus = allComplete
          ? "Completed"
          : anyReceived
            ? "Partially Received"
            : "Pending";

        await tx.toolsPoSchMaster.update({
          where: { id: sch.id },
          data: { overallStatus },
        });
      }

      return grn;
    });

    return NextResponse.json({ ok: true, grn: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
