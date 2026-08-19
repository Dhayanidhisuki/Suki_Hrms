import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { buildDcPdfBuffer } from "@/lib/dcPdf";
import { dcVerificationUrl } from "@/lib/dcQrUrl";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const dcNo = decodeURIComponent(id).trim();
  if (!dcNo) {
    return NextResponse.json({ error: "Invalid DC number" }, { status: 400 });
  }

  try {
    const issue = await prisma.gaugeToolsIssue.findUnique({
      where: { dcNo },
      include: {
        lines: {
          include: { tool: true, toolByRef: true },
          orderBy: { rowId: "asc" },
        },
      },
    });
    if (!issue) {
      return NextResponse.json({ error: "Movement DC not found" }, { status: 404 });
    }

    const isExplicitExternalMovement = issue.issueOption?.startsWith("External:") ?? false;
    const isInternalMovement =
      issue.issueOption === "Internal Unit Movement" ||
      issue.lines.some((line) => Boolean(line.issueToItemNo));
    let recipientName: string | null = null;
    let recipientAddress1: string | null = null;
    let recipientAddress2: string | null = null;
    let recipientGstin: string | null = null;
    let natureOfWork: string | null = null;

    if (issue.subCode) {
      const party = await prisma.subcontractor.findUnique({
        where: { subConId: issue.subCode },
        select: { subName: true, add1: true, add2: true, gstin: true, natureOfWork: true },
      });
      recipientName = party?.subName ?? null;
      recipientAddress1 = party?.add1 ?? null;
      recipientAddress2 = party?.add2 ?? null;
      recipientGstin = party?.gstin ?? null;
      natureOfWork = party?.natureOfWork ?? null;
    } else if (issue.supCode) {
      const party = await prisma.supplier.findUnique({
        where: { supCode: issue.supCode },
        select: { supName: true, add1: true, city: true, state: true, gstin: true },
      });
      recipientName = party?.supName ?? null;
      recipientAddress1 = party?.add1 ?? null;
      recipientAddress2 = [party?.city, party?.state].filter(Boolean).join(", ") || null;
      recipientGstin = party?.gstin ?? null;
    }

    const destinationUnit = issue.lines.find((line) => line.issueToItemNo)?.issueToItemNo;
    const issueFor = isExplicitExternalMovement
      ? issue.issueOption?.replace(/^External:/, "") || "External Movement"
      : isInternalMovement
        ? "Internal Movement"
        : issue.issueOption || "SubContractor Issue";

    const isInternal = isInternalMovement && !isExplicitExternalMovement && !issue.subCode && !issue.supCode;

    const buffer = buildDcPdfBuffer({
      dcType: isInternal ? "MOVEMENT" : "ISSUE",
      dcNo: issue.dcNo,
      recipientName,
      receiveName: issue.receiveName,
      receiver: issue.receiveName,
      fromUnit: issue.fromUnit,
      purpose: issue.issuePurpose,
      natureOfWork,
      subCode: issue.subCode || issue.supCode || issue.custCode || destinationUnit,
      issueDate: issue.issueDate,
      dueDate: issue.dueDate,
      issueFor,
      toolsPoNo: issue.poOrderNo,
      status: issue.status,
      returnable: issue.returnable,
      transportName: issue.transportName,
      vehicleNo: issue.vehicleNo,
      comments: issue.comments,
      preparedBy: issue.creatUserIdCd,
      companyName: "Manpro Equipments Private Limited",
      recipientAddress1,
      recipientAddress2,
      recipientGstin,
      verificationUrl: dcVerificationUrl(req, "movement", issue.dcNo),
      lines: issue.lines.map((line) => {
        const tool = line.tool ?? line.toolByRef;
        return {
          toolOrGaugeNo: line.toolOrGaugeNo ?? tool?.toolOrGaugeNo ?? line.partNo,
          name: line.name ?? tool?.name,
          description: line.description ?? tool?.description,
          type: line.type ?? tool?.type,
          grouping: line.groupName ?? tool?.grouping,
          destinationUnit: line.issueToItemNo,
          usedLocation: tool?.location,
          issueQty: Number(line.issueQty ?? 1),
          serialNo: line.serialNo,
          dueDate: line.dueDate,
          status: line.status,
          remarks: line.remarks,
          machine: line.machine,
          price: Number(line.price ?? 0),
        };
      }),
    });

    const kind = isInternal ? "Internal_Movement_DC" : "External_Movement_DC";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${kind}_${issue.dcNo}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/issue/[id]/pdf failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate movement DC PDF" },
      { status: 500 }
    );
  }
}
