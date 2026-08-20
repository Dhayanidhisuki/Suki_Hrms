import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { buildCalibDcPdfBuffer } from "@/lib/calibDcPdf";
import { dcVerificationUrl } from "@/lib/dcQrUrl";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const dcNo = Number(id);
  if (!Number.isFinite(dcNo) || dcNo < 1) {
    return NextResponse.json({ error: "Invalid DC number" }, { status: 400 });
  }

  try {
    const issue = await prisma.toolsIssueForCalibration.findUnique({
      where: { dcNo },
      include: {
        inHouseLines: { include: { tool: true }, orderBy: { rowId: "asc" } },
        receiveHeaders: { select: { recNo: true } },
      },
    });

    if (!issue) {
      return NextResponse.json({ error: "Calibration issue not found" }, { status: 404 });
    }
    const unitScope = await resolveUnitScope(check.session);
    if (!issue.inHouseLines.some((line) => unitIsAllowed(unitScope, line.tool?.locationName))) {
      return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
    }

    const receives = issue.receiveHeaders?.length ?? 0;
    const lines = issue.inHouseLines ?? [];
    const done = lines.filter((l) => {
      const r = String(l.resultStatus ?? "").trim().toUpperCase();
      return r.length > 0 && r !== "PENDING";
    }).length;
    const status =
      receives > 0 || (done > 0 && done === lines.length)
        ? "CLOSED"
        : done > 0
          ? "PARTIAL"
          : "OPEN";

    let companyName: string | null = null;
    let subcontractor: { subName: string | null; add1: string | null; add2: string | null; gstin: string | null; natureOfWork: string | null } | null = null;
    try {
      const companies = await prisma.$queryRawUnsafe<
        Array<{ COMPANY_NAME?: string; DISP_COMPANY_NAME?: string }>
      >(`SELECT TOP 1 COMPANY_NAME, DISP_COMPANY_NAME FROM COMPANY_DETAILS ORDER BY COMPANY_NAME`);
      companyName =
        companies[0]?.DISP_COMPANY_NAME?.trim() ||
        companies[0]?.COMPANY_NAME?.trim() ||
        null;
    } catch {
      // company table optional
    }
    if (issue.subCode) {
      subcontractor = await prisma.subcontractor.findUnique({
        where: { subConId: issue.subCode },
        select: { subName: true, add1: true, add2: true, gstin: true, natureOfWork: true },
      });
    }

    const buffer = buildCalibDcPdfBuffer({
      dcNo: issue.dcNo,
      recipientName: subcontractor?.subName,
      receiveName: issue.receiveName,
      subCode: issue.subCode,
      subAddress1: subcontractor?.add1,
      subAddress2: subcontractor?.add2,
      subGstin: subcontractor?.gstin,
      issueDate: issue.issueDate,
      issueFor: issue.issueFor,
      toolsPoNo: issue.toolsPoNo,
      status,
      companyName,
      preparedBy: issue.creatUserIdCd,
      verificationUrl: dcVerificationUrl(req, "calibration", dcNo),
      lines: lines.map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo,
        name: l.tool?.name ?? null,
        description: l.tool?.description ?? null,
        size: l.tool?.size ?? null,
        detailedSpec: l.tool?.detailedSpec ?? null,
        price: Number(l.tool?.price ?? 0),
        remarks: l.remarks,
        grouping: l.grouping,
        issueQty: l.issueQty,
        serialNo: l.serialNo,
        dueDate: l.dueDate,
        calibDueDate: l.calibDueDate,
        status: l.status,
      })),
    });

    const filename = `Calibration_DC_${dcNo}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/calibration/issue/[id]/pdf failed:", err);
    const message = err instanceof Error ? err.message : "Failed to generate DC PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
