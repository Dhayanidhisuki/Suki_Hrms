import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
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

  const { issueType, labName, issueDate, expectedReturnDate, toolOrGaugeNos } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const calibDcNo = await generateDocNumber(
        "CALIB-DC",
        "TOOLS_ISSUE_FOR_CALIBRATION",
        "CALIB_DC_NO"
      );

      const header = await tx.toolsIssueForCalibration.create({
        data: {
          calibDcNo,
          issueType,
          labName,
          issueDate: new Date(issueDate),
          expectedReturnDate: new Date(expectedReturnDate),
          status: "OPEN",
          creatUserIdCd: authCheck.session.userId,
        },
      });

      for (const toolNo of toolOrGaugeNos) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: toolNo },
        });

        await tx.toolsTransIssueForCalibration.create({
          data: {
            calibDcNo,
            toolOrGaugeNo: toolNo,
            lastCalibDate: tool?.lastCalibrationDate ?? null,
            dueDate: tool?.nextCalibrationDate ?? null,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: toolNo },
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
