import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/pricing/[id]/approve
 * Copies PROPOSED_RATE → RATE; sets APPROVED. Live rate only changes here.
 */
export async function PUT(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(
    authCheck.session,
    "canApprovePricing"
  );
  if (!permCheck.ok) return permCheck.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
  if (existing.proposedRate == null) {
    return NextResponse.json(
      { error: "No proposed rate to approve" },
      { status: 400 }
    );
  }

  const now = new Date();
  const updated = await prisma.toolsPriceMaster.update({
    where: { rowId },
    data: {
      rate: existing.proposedRate,
      proposedRate: null,
      approvalStatus: "APPROVED",
      approvalDate: now,
      approvedBy: authCheck.session.userId.slice(0, 50),
      approvedAt: now,
      rejectedReason: null,
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
      approvedBy: updated.approvedBy,
      approvedAt: updated.approvedAt,
      toolOrGaugeNo: updated.tool?.toolOrGaugeNo ?? null,
      supCode: updated.supCode,
    },
  });
}
