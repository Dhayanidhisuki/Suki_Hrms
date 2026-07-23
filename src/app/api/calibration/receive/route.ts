import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
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

  const { calibDcNo, receiveDate, lines } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const calibRcvNo = await generateDocNumber(
        "CALIB-RCV",
        "TOOLS_RECEIVE_FOR_CALIBRATION",
        "CALIB_RCV_NO"
      );

      const header = await tx.toolsReceiveForCalibration.create({
        data: {
          calibRcvNo,
          calibDcNo,
          receiveDate: new Date(receiveDate),
          creatUserIdCd: authCheck.session.userId,
        },
      });

      for (const line of lines) {
        const calibDate = new Date(line.calibrationDate);
        const nextDate = new Date(line.nextCalibDate);

        await tx.toolsTransReceiveForCalibration.create({
          data: {
            calibRcvNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            calibrationDate: calibDate,
            result: line.result,
            nextCalibDate: nextDate,
            certificateFileName: line.certificateFileName,
            remarks: line.remarks,
          },
        });

        const newStatus = line.result === "Fail" ? "Under Repair" : "Available";

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            lastCalibrationDate: calibDate,
            nextCalibrationDate: nextDate,
            status: newStatus,
            lstUpdtUserIdCd: authCheck.session.userId,
          },
        });

        await tx.gaugeControlCardTrans.create({
          data: {
            toolOrGaugeNo: line.toolOrGaugeNo,
            calibrationDate: calibDate,
            result: line.result,
            nextCalibDate: nextDate,
            certificateFileName: line.certificateFileName,
            remarks: line.remarks,
            creatUserIdCd: authCheck.session.userId,
          },
        });

        await tx.gaugeControlCard.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            lastCalibrationDate: calibDate,
            nextCalibDate: nextDate,
            lastResult: line.result,
          },
        });
      }

      await tx.toolsIssueForCalibration.update({
        where: { calibDcNo },
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
