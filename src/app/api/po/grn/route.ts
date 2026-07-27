import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
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

  const { poOrderNo, supCode, girDate, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const grn = await tx.toolsPoReceive.create({
        data: {
          poOrderNo,
          supCode,
          girDate: new Date(girDate),
          girStatus: "Posted",
          creatUserIdCd: authCheck.session.userId,
        },
      });

      const girNo = grn.girNo;

      for (const line of lines) {
        await tx.toolsPoReceiveTrans.create({
          data: {
            girNo,
            itemCode: line.itemCode,
            invQty: line.invQty,
            recQty: line.recQty,
            price: line.price,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.itemCode },
          data: {
            qtyNew: { increment: line.recQty },
            totQty: { increment: line.recQty },
            qtyIn: { increment: line.recQty },
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });

        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.itemCode },
        });

        await tx.toolsPriceMaster.create({
          data: {
            toolRefNo: tool?.refNo,
            revDate: new Date(girDate),
            supCode,
            rate: line.price,
            creatUserIdCd: authCheck.session.userId,
            creatDt: new Date(),
          },
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
