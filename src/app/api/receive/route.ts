import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
import { ToolsReceiveCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const issues = await prisma.gaugeToolsIssue.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
    include: { lines: true },
    orderBy: { issueDate: "desc" },
  });
  return NextResponse.json({ items: issues });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canReceiveTool");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = ToolsReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { dcNo, receiveDate, subCode, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const header = await tx.toolsIssueReceived.create({
        data: {
          dcNo,
          receiveDate: new Date(receiveDate),
          subCode,
          creatUserIdCd: authCheck.session.userId,
        },
      });

      const recNo = header.recNo;

      for (const line of lines) {
        const issueLine = await tx.toolsTransIssue.findFirst({
          where: { dcNo, toolOrGaugeNo: line.toolOrGaugeNo },
        });
        if (!issueLine) {
          throw new Error(`No issue line found for ${line.toolOrGaugeNo}`);
        }

        await tx.toolsIssueReceivedTrans.create({
          data: {
            recNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            quantity: line.quantity,
            creatUserIdCd: authCheck.session.userId,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            qtyIn: { increment: line.quantity },
            qtyOut: { decrement: line.quantity },
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });
      }

      await tx.gaugeToolsIssue.update({
        where: { dcNo },
        data: { status: "CLOSED", lstUpdtUserIdCd: authCheck.session.userId },
      });

      return { header, status: "CLOSED" };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
