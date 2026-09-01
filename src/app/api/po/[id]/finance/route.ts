import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { PurchaseOrderFinanceUpdateSchema } from "@/lib/validators";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";
import { checkModulePermission } from "@/lib/rbac";

async function creatUserCode(session: {
  userId: string;
  userDbId: number | null;
}): Promise<string> {
  if (session.userDbId != null) {
    const u = await prisma.user.findUnique({
      where: { id: session.userDbId },
      select: { erpUserCode: true },
    });
    if (u?.erpUserCode?.trim()) return u.erpUserCode.trim().slice(0, 10);
  }
  return session.userId.slice(0, 10);
}

/**
 * PUT /api/po/[id]/finance — update Tools-owned payment status on TOOLS_PO_FINANCE.
 * [id] = PO_ORDER_NO (URL-encoded).
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "purchase", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const poOrderNo = decodeURIComponent(id || "").trim();
  if (!poOrderNo) {
    return NextResponse.json({ error: "PO number required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PurchaseOrderFinanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const po = await prisma.commonPurchaseOrder.findUnique({
    where: { poOrderNo },
    select: { poOrderNo: true, lines: { select: { tool: { select: { locationName: true } } } } },
  });
  if (!po) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }
  const unitScope = await resolveUnitScope(authCheck.session);
  if (!unitScope.unrestricted && !po.lines.some((line) => unitIsAllowed(unitScope, line.tool?.locationName))) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const { paymentStatus, paymentDate, remarks } = parsed.data;
  const creatUser = await creatUserCode(authCheck.session);
  const now = new Date();
  const payDate =
    paymentDate != null && paymentDate !== ""
      ? new Date(paymentDate)
      : paymentStatus === "PAID" || paymentStatus === "PARTIAL"
        ? now
        : null;

  try {
    const finance = await prisma.toolsPoFinance.upsert({
      where: { poOrderNo },
      create: {
        poOrderNo,
        paymentStatus,
        paymentDate: paymentStatus === "UNPAID" ? null : payDate,
        remarks: remarks?.slice(0, 200) ?? null,
        creatUserIdCd: creatUser,
        creatDt: now,
        lstUpdtUserIdCd: creatUser,
        lstUpdtTs: now,
      },
      update: {
        paymentStatus,
        paymentDate: paymentStatus === "UNPAID" ? null : payDate,
        remarks: remarks === undefined ? undefined : remarks?.slice(0, 200) ?? null,
        lstUpdtUserIdCd: creatUser,
        lstUpdtTs: now,
      },
    });

    return NextResponse.json({
      ok: true,
      finance: {
        poOrderNo: finance.poOrderNo,
        paymentStatus: finance.paymentStatus,
        paymentDate: finance.paymentDate,
        remarks: finance.remarks,
      },
    });
  } catch (err) {
    console.error("PUT /api/po/[id]/finance:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update payment status" },
      { status: 500 }
    );
  }
}
