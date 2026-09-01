import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { checkModulePermission } from "@/lib/rbac";
import { PricingRejectSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/pricing/[id]/reject
 * Clears PROPOSED_RATE; leaves live RATE untouched.
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(
    authCheck.session,
    "tool_pricing",
    "APPROVE"
  );
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PricingRejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.toolsPriceMaster.findUnique({
    where: { rowId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Price row not found" }, { status: 404 });
  }

  const status = (existing.approvalStatus ?? "").trim().toUpperCase();
  if (status !== "PENDING") {
    return NextResponse.json(
      { error: `Row is not PENDING (current: ${existing.approvalStatus || "—"})` },
      { status: 400 }
    );
  }

  const updated = await prisma.toolsPriceMaster.update({
    where: { rowId },
    data: {
      proposedRate: null,
      approvalStatus: "REJECTED",
      rejectedReason: parsed.data.reason.slice(0, 500),
      // live RATE untouched; clear submit metadata for next cycle clarity
      approvedBy: null,
      approvedAt: null,
    },
    include: {
      tool: {
        select: { toolOrGaugeNo: true, name: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    item: {
      rowId: updated.rowId,
      rate: updated.rate != null ? Number(updated.rate) : null,
      proposedRate: null,
      approvalStatus: updated.approvalStatus,
      rejectedReason: updated.rejectedReason,
      toolOrGaugeNo: updated.tool?.toolOrGaugeNo ?? null,
      supCode: updated.supCode,
    },
  });
}
