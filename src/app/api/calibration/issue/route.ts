import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { CalibIssueCreateSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const statusFilter = req.nextUrl.searchParams.get("status");
  const items = await prisma.toolsIssueForCalibration.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    include: { inHouseLines: { include: { tool: true } } },
    orderBy: { creatDt: "desc" },
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
  const parsed = CalibIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { receiveName, subCode, issueDate, issueFor, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const header = await tx.toolsIssueForCalibration.create({
        data: {
          receiveName,
          subCode,
          issueDate: new Date(issueDate),
          issueFor,
          creatUserIdCd: authCheck.session.userId,
        },
      });

      const dcNo = header.dcNo;

      for (const line of lines) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
        });

        await tx.toolsTransIssueForCalibration.create({
          data: {
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            issueQty: line.issueQty,
            creatUserIdCd: authCheck.session.userId,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            status: "Under Calibration",
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });
      }

      return header;
    });

    return NextResponse.json({ ok: true, header: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
