import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
import { ToolsIssueCreateSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const statusFilter = req.nextUrl.searchParams.get("status");
  const issues = await prisma.gaugeToolsIssue.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    include: { lines: true },
    orderBy: { creatDt: "desc" },
  });
  return NextResponse.json({ items: issues });
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

  const { deptName, partyName, issueDate, dueDate, lines } = parsed.data;

  try {
    const issue = await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
        });
        if (!tool || tool.qtyIn < line.qtyIssued) {
          throw new Error(
            `Insufficient stock for ${line.toolOrGaugeNo}. Available: ${tool?.qtyIn ?? 0}, Requested: ${line.qtyIssued}`
          );
        }
      }

      const dcNo = await generateDocNumber("DC", "GAUGE_TOOLS_ISSUE", "DC_NO");

      const header = await tx.gaugeToolsIssue.create({
        data: {
          dcNo,
          deptName,
          partyName,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          status: "OPEN",
          creatUserIdCd: authCheck.session.userId,
        },
      });

      for (const line of lines) {
        await tx.toolsTransIssue.create({
          data: {
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            qtyIssued: line.qtyIssued,
            qtyReturned: 0,
            remainingQty: line.qtyIssued,
            status: "Open",
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            qtyIn: { decrement: line.qtyIssued },
            qtyOut: { increment: line.qtyIssued },
            status: "Issued",
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });
      }

      return header;
    });

    return NextResponse.json({ ok: true, issue }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
