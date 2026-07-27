import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { CalibReceiveCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const items = await prisma.toolsReceiveForCalibration.findMany({
    orderBy: { creatDt: "desc" },
    include: { lines: { include: { tool: true } }, calibIssue: true },
  });
  return NextResponse.json({ items });
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

  const { dcNo, receiveDate, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const header = await tx.toolsReceiveForCalibration.create({
        data: {
          dcNo,
          receiveDate: new Date(receiveDate),
          creatUserIdCd: authCheck.session.userId,
        },
      });

      const recNo = header.recNo;

      for (const line of lines) {
        await tx.toolsTransReceiveForCalibration.create({
          data: {
            recNo,
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            qty: line.qty,
            price: line.price,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            status: "Available",
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });
      }

      await tx.toolsIssueForCalibration.update({
        where: { dcNo },
        data: { status: "CLOSED" },
      });

      return header;
    });

    return NextResponse.json({ ok: true, header: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
