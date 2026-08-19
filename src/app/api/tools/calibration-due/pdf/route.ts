import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { buildCalibRecordPdfBuffer } from "@/lib/calibRecordPdf";
import { verifyCalibrationPdfToken } from "@/lib/calibrationPdfLink";

export async function GET(req: NextRequest) {
  const toolOrGaugeNo = (req.nextUrl.searchParams.get("toolOrGaugeNo") ?? "").trim();
  if (!toolOrGaugeNo) {
    return NextResponse.json({ error: "toolOrGaugeNo is required" }, { status: 400 });
  }
  const token = (req.nextUrl.searchParams.get("token") ?? "").trim();
  if (!token || !verifyCalibrationPdfToken(token, toolOrGaugeNo)) {
    const session = await getSession();
    const check = await requireSession(session);
    if (!check.ok) return check.response;
  }

  try {
    const tool = await prisma.gaugeAndTools.findFirst({
      where: { toolOrGaugeNo },
      select: {
        toolOrGaugeNo: true,
        name: true,
        grouping: true,
        type: true,
        status: true,
        location: true,
        calibrationFrqMonths: true,
      },
    });

    const lines = await prisma.toolsTransIssueForCalibration.findMany({
      where: { toolOrGaugeNo },
      orderBy: [{ nxtCalibDate: "asc" }, { creatDt: "desc" }],
      take: 25,
      select: {
        dcNo: true,
        serialNo: true,
        dueDate: true,
        calibDueDate: true,
        nxtCalibDate: true,
        calibratedDate: true,
        status: true,
        calibrationStatus: true,
        resultStatus: true,
        remarks: true,
        calibResultComments: true,
        creatDt: true,
      },
    });

    if (!tool && lines.length === 0) {
      return NextResponse.json({ error: "Calibration record not found" }, { status: 404 });
    }

    const earliest = [...lines].sort((a, b) => {
      const da = (a.nxtCalibDate ?? a.calibDueDate ?? a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = (b.nxtCalibDate ?? b.calibDueDate ?? b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    })[0];

    const latestDone = [...lines]
      .filter((l) => l.calibratedDate)
      .sort(
        (a, b) =>
          (b.calibratedDate?.getTime() ?? 0) - (a.calibratedDate?.getTime() ?? 0)
      )[0];

    let companyName: string | null = null;
    try {
      const companies = await prisma.$queryRawUnsafe<
        Array<{ COMPANY_NAME?: string; DISP_COMPANY_NAME?: string }>
      >(`SELECT TOP 1 COMPANY_NAME, DISP_COMPANY_NAME FROM COMPANY_DETAILS ORDER BY COMPANY_NAME`);
      companyName =
        companies[0]?.DISP_COMPANY_NAME?.trim() ||
        companies[0]?.COMPANY_NAME?.trim() ||
        null;
    } catch {
      // optional
    }

    const frequency =
      tool?.calibrationFrqMonths != null ? `${tool.calibrationFrqMonths} Months` : null;

    const buffer = buildCalibRecordPdfBuffer({
      toolOrGaugeNo,
      name: tool?.name ?? null,
      grouping: tool?.grouping ?? null,
      type: tool?.type ?? null,
      status:
        earliest?.resultStatus ??
        earliest?.calibrationStatus ??
        earliest?.status ??
        tool?.status ??
        null,
      frequency,
      usedLocation: tool?.location ?? null,
      lastCalibrated: latestDone?.calibratedDate ?? null,
      nextCalibrationDate:
        earliest?.nxtCalibDate ?? earliest?.calibDueDate ?? earliest?.dueDate ?? null,
      remarks:
        earliest?.calibResultComments ?? earliest?.remarks ?? null,
      companyName,
      history: lines.map((l) => ({
        dcNo: l.dcNo,
        serialNo: l.serialNo,
        dueDate: l.dueDate,
        calibratedDate: l.calibratedDate,
        nextCalibDate: l.nxtCalibDate ?? l.calibDueDate,
        status: l.status ?? l.calibrationStatus,
        resultStatus: l.resultStatus,
        remarks: l.calibResultComments ?? l.remarks,
      })),
    });

    const safeName = toolOrGaugeNo.replace(/[^\w\-]+/g, "_").slice(0, 40);
    const filename = `Calibration_Record_${safeName}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/tools/calibration-due/pdf failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate calibration record PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
