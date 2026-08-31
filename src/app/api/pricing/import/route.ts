import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";

const BulkPricingSchema = z.object({
  rows: z.array(z.object({
    toolOrGaugeNo: z.string().trim().min(1).max(25),
    supCode: z.string().trim().max(10).optional().nullable(),
    proposedRate: z.coerce.number().finite().nonnegative(),
    effectiveDate: z.string().trim().optional().nullable(),
    remarks: z.string().trim().max(200).optional().nullable(),
  })).min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  const auth = await requireSession(session);
  if (!auth.ok) return auth.response;

  const editOk = await requirePermission(auth.session, "canEditMaster");
  const poOk = await requirePermission(auth.session, "canRaisePO");
  if (!editOk.ok && !poOk.ok) return editOk.ok === false ? editOk.response : poOk.response;

  const parsed = BulkPricingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const requestedNos = [...new Set(parsed.data.rows.map((row) => row.toolOrGaugeNo.toUpperCase()))];
  const tools = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: requestedNos } },
    select: { refNo: true, toolOrGaugeNo: true },
  });
  const toolByNo = new Map(tools.map((tool) => [(tool.toolOrGaugeNo ?? "").toUpperCase(), tool]));
  const now = new Date();
  const rejected: Array<{ row: number; toolOrGaugeNo: string; reason: string }> = [];
  const accepted = parsed.data.rows.flatMap((row, index) => {
    const tool = toolByNo.get(row.toolOrGaugeNo.toUpperCase());
    if (!tool) {
      rejected.push({ row: index + 2, toolOrGaugeNo: row.toolOrGaugeNo, reason: "Instrument number not found" });
      return [];
    }
    const effectiveDate = row.effectiveDate ? new Date(row.effectiveDate) : now;
    if (Number.isNaN(effectiveDate.getTime())) {
      rejected.push({ row: index + 2, toolOrGaugeNo: row.toolOrGaugeNo, reason: "Invalid effective date" });
      return [];
    }
    return [{
      toolRefNo: tool.refNo,
      supCode: row.supCode || null,
      rate: null,
      proposedRate: row.proposedRate,
      revDate: effectiveDate,
      revStatus: "PROPOSED",
      approvalStatus: "PENDING",
      submittedBy: auth.session.userId.slice(0, 50),
      submittedAt: now,
      remarks: row.remarks || null,
      creatUserIdCd: auth.session.userId.slice(0, 10),
      creatDt: now,
    }];
  });

  if (accepted.length) await prisma.toolsPriceMaster.createMany({ data: accepted });
  return NextResponse.json({ ok: true, submitted: accepted.length, rejected });
}
