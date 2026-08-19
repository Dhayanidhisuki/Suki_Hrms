import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { buildReceiveDcPdfBuffer } from "@/lib/receiveDcPdf";
import { dcVerificationUrl } from "@/lib/dcQrUrl";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const recNo = Number(id);
  if (!Number.isSafeInteger(recNo) || recNo < 1) {
    return NextResponse.json({ error: "Invalid receive DC number" }, { status: 400 });
  }

  const receive = await prisma.toolsIssueReceived.findUnique({
    where: { recNo },
    include: {
      lines: { include: { tool: true }, orderBy: { rowId: "asc" } },
      issueHeader: { include: { lines: true } },
    },
  });
  if (!receive) {
    return NextResponse.json({ error: "Receive DC not found" }, { status: 404 });
  }

  const issueLines = new Map(receive.issueHeader.lines.map((line) => [line.rowId, line]));
  const movement = Boolean(
    receive.issueHeader.issueOption === "Internal Unit Movement" ||
      receive.issueHeader.issueOption?.startsWith("External:") ||
      receive.issueHeader.lines.some((line) => line.issueToItemNo)
  );
  const destination = receive.lines
    .map((line) => line.toolIssRefNo == null ? null : issueLines.get(line.toolIssRefNo)?.issueToItemNo)
    .find(Boolean) ?? null;

  const buffer = buildReceiveDcPdfBuffer({
    recNo: receive.recNo,
    issueDcNo: receive.dcNo,
    receiveDate: receive.receiveDate,
    receivedFrom: receive.contName,
    receivedBy: receive.creatUserIdCd,
    fromUnit: receive.issueHeader.fromUnit,
    toUnit: destination,
    location: receive.location,
    movement,
    verificationUrl: dcVerificationUrl(req, "receive", receive.recNo),
    lines: receive.lines.map((line) => {
      const issueLine = line.toolIssRefNo == null ? null : issueLines.get(line.toolIssRefNo);
      return {
        toolNo: line.toolOrGaugeNo ?? line.tool?.toolOrGaugeNo ?? null,
        description: issueLine?.description ?? issueLine?.name ?? line.tool?.description ?? line.tool?.name ?? null,
        size: line.tool?.size ?? null,
        serialNo: line.serialNo,
        quantity: Number(line.quantity ?? 0),
        status: line.status,
      };
    }),
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Receive_DC_REC-${receive.recNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
