import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { buildDcPdfBuffer } from "@/lib/dcPdf";
import { dcQrUrl } from "@/lib/dcQrUrl";

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

    const external = issue.issueOption?.startsWith("External:") ?? false;
    const internal =
      issue.issueOption === "Internal Unit Movement" ||
      issue.lines.some((line) => Boolean(line.issueToItemNo));
    if (!internal && !external) {
      return NextResponse.json({ error: "This record is not a movement DC" }, { status: 400 });
    }

    let recipientAddress1: string | null = null;
    let recipientAddress2: string | null = null;
    let recipientGstin: string | null = null;
    if (external && issue.subCode) {
      const party = await prisma.subcontractor.findUnique({
        where: { subConId: issue.subCode },
        select: { add1: true, add2: true, gstin: true },
      });
      recipientAddress1 = party?.add1 ?? null;
      recipientAddress2 = party?.add2 ?? null;
      recipientGstin = party?.gstin ?? null;
    } else if (external && issue.supCode) {
      const party = await prisma.supplier.findUnique({
        where: { supCode: issue.supCode },
        select: { add1: true, city: true, state: true, gstin: true },
      });
      recipientAddress1 = party?.add1 ?? null;
      recipientAddress2 = [party?.city, party?.state].filter(Boolean).join(", ") || null;
      recipientGstin = party?.gstin ?? null;
    }

    const destinationUnit = issue.lines.find((line) => line.issueToItemNo)?.issueToItemNo;
    const issueFor = external
      ? issue.issueOption?.replace(/^External:/, "") || "External Movement"
      : "Internal Movement";
    const buffer = buildDcPdfBuffer({
      dcType: external ? "ISSUE" : "MOVEMENT",
      dcNo: issue.dcNo,
      receiveName: issue.receiveName,
      receiver: issue.receiveName,
      fromUnit: issue.fromUnit,
      purpose: issue.issuePurpose,
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
      verificationUrl: dcQrUrl(req, `/api/issue/${encodeURIComponent(issue.dcNo)}`),
      lines: issue.lines.map((line) => {
        const tool = line.tool ?? line.toolByRef;
        return {
          toolOrGaugeNo: line.toolOrGaugeNo ?? tool?.toolOrGaugeNo ?? line.partNo,
          name: line.name ?? tool?.name,
          description: line.description ?? tool?.description,
          type: line.type ?? tool?.type,
          grouping: line.groupName ?? tool?.grouping,
          destinationUnit: line.issueToItemNo,
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

    const kind = external ? "External_Movement_DC" : "Internal_Movement_DC";
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
