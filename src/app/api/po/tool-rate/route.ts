import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/po/tool-rate?toolOrGaugeNo=&supCode=
 * Latest approved live RATE from TOOLS_PRICE_MASTER for Create PO autofill.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const toolOrGaugeNo = (req.nextUrl.searchParams.get("toolOrGaugeNo") || "").trim();
  const supCode = (req.nextUrl.searchParams.get("supCode") || "").trim();
  if (!toolOrGaugeNo) {
    return NextResponse.json({ error: "toolOrGaugeNo required" }, { status: 400 });
  }

  const tool = await prisma.gaugeAndTools.findUnique({
    where: { toolOrGaugeNo },
    select: { refNo: true, toolOrGaugeNo: true, name: true, description: true },
  });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const rows = await prisma.toolsPriceMaster.findMany({
    where: {
      toolRefNo: tool.refNo,
      OR: [
        { approvalStatus: null },
        { approvalStatus: "" },
        { approvalStatus: { equals: "APPROVED" } },
        { approvalStatus: { equals: "Approved" } },
        { approvalStatus: { equals: "Yes" } },
      ],
    },
    orderBy: [{ creatDt: "desc" }, { rowId: "desc" }],
    take: 30,
    select: { rate: true, supCode: true, approvalStatus: true, rowId: true },
  });

  const withRate = rows.filter((r) => r.rate != null);
  const match = supCode
    ? withRate.find(
        (r) => (r.supCode ?? "").trim().toUpperCase() === supCode.toUpperCase()
      )
    : null;
  const pick = match ?? withRate[0] ?? null;

  return NextResponse.json({
    tool: { ...tool, uom: "Nos" },
    rate: pick?.rate != null ? Number(pick.rate) : null,
    priceRowId: pick?.rowId ?? null,
    matchedSupCode: pick?.supCode ?? null,
  });
}
