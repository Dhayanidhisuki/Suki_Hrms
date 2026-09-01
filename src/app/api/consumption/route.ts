import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { ConsumptionCreateSchema } from "@/lib/validators";
import { checkModulePermission } from "@/lib/rbac";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const items = await prisma.toolsConsumptionTransIssue.findMany({
    orderBy: { creatDt: "desc" },
    include: { tool: true },
  });

  // Batch lookup dcNo from ToolsTransIssue by issueRefNo (rowId)
  const issueRefNos = items
    .map((i) => i.issueRefNo)
    .filter((v): v is number => v != null);
  const issueLines = issueRefNos.length
    ? await prisma.toolsTransIssue.findMany({
        where: { rowId: { in: issueRefNos } },
        select: { rowId: true, dcNo: true },
      })
    : [];
  const dcMap = new Map(issueLines.map((l) => [l.rowId, l.dcNo]));

  const mapped = items.map((item) => ({
    rowId: item.rowId,
    dcNo: item.issueRefNo ? dcMap.get(item.issueRefNo) ?? "" : "",
    toolOrGaugeNo: item.toolOrGaugeNo ?? "",
    worksheetRef: item.workSheetRefNo?.toString() ?? "",
    qtyConsumed: Number(item.qty ?? 0),
    consumptionDate: item.creatDt?.toISOString() ?? "",
    verifiedBySupervisor: item.verified === "Y",
    verifiedBy: null as string | null,
    creatUserIdCd: item.creatUserIdCd,
    tool: item.tool ? { name: item.tool.name } : null,
  }));

  return NextResponse.json({ items: mapped });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "tool_issue_receive", "CREATE");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = ConsumptionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { dcNo, toolOrGaugeNo, worksheetRef, qtyConsumed, verifiedBySupervisor } = parsed.data;

  // Look up the issue line to get issueRefNo (rowId)
  const issueLine = await prisma.toolsTransIssue.findFirst({
    where: { dcNo, toolOrGaugeNo },
  });

  const record = await prisma.toolsConsumptionTransIssue.create({
    data: {
      issueRefNo: issueLine?.rowId,
      toolOrGaugeNo,
      workSheetRefNo: Number(worksheetRef),
      qty: qtyConsumed,
      verified: verifiedBySupervisor ? "Y" : "N",
      creatUserIdCd: authCheck.session.userId,
      creatDt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, record }, { status: 201 });
}
