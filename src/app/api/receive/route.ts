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

  const { dcNo, receiveDate, remarks, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receiveNo = await generateDocNumber("RCV", "TOOLS_ISSUE_RECEIVED", "RECEIVE_NO");

      const header = await tx.toolsIssueReceived.create({
        data: {
          receiveNo,
          dcNo,
          receiveDate: new Date(receiveDate),
          remarks,
          creatUserIdCd: authCheck.session.userId,
        },
      });

      let allClosed = true;

      for (const line of lines) {
        const issueLine = await tx.toolsTransIssue.findFirst({
          where: { dcNo, toolOrGaugeNo: line.toolOrGaugeNo },
        });
        if (!issueLine || line.qtyReturned > issueLine.remainingQty) {
          throw new Error(
            `Return qty for ${line.toolOrGaugeNo} exceeds remaining ${issueLine?.remainingQty ?? 0}`
          );
        }

        const newRemaining = issueLine.remainingQty - line.qtyReturned;

        await tx.toolsIssueReceivedTrans.create({
          data: {
            receiveNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            qtyReturned: line.qtyReturned,
          },
        });

        await tx.toolsTransIssue.update({
          where: { id: issueLine.id },
          data: {
            qtyReturned: { increment: line.qtyReturned },
            remainingQty: newRemaining,
            status: newRemaining === 0 ? "Returned" : "Open",
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            qtyIn: { increment: line.qtyReturned },
            qtyOut: { decrement: line.qtyReturned },
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });

        if (newRemaining > 0) allClosed = false;
      }

      const newStatus = allClosed ? "CLOSED" : "PARTIAL";
      await tx.gaugeToolsIssue.update({
        where: { dcNo },
        data: { status: newStatus, lstUpdtUserId: authCheck.session.userId },
      });

      return { header, status: newStatus };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
