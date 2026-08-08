import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { loadEsskayPricing } from "@/lib/esskayPricing";
import { PricingProposeSchema } from "@/lib/validators";

function mapPriceRow(r: {
  rowId: number;
  toolRefNo: number | null;
  supCode: string | null;
  rate: { toString(): string } | null;
  proposedRate: { toString(): string } | null;
  revNo: string | null;
  revDate: Date | null;
  revStatus: string | null;
  approvalStatus: string | null;
  approvalDate: Date | null;
  submittedBy: string | null;
  submittedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  remarks: string | null;
  creatUserIdCd: string | null;
  creatDt: Date;
  tool?: {
    toolOrGaugeNo: string | null;
    name: string | null;
    grouping: string | null;
    type: string | null;
  } | null;
}) {
  const approvalStatus = (r.approvalStatus ?? "").trim() || "APPROVED";
  return {
    rowId: r.rowId,
    toolOrGaugeNo: r.tool?.toolOrGaugeNo ?? null,
    toolName: r.tool?.name ?? null,
    toolRefNo: r.toolRefNo,
    grouping: r.tool?.grouping ?? null,
    type: r.tool?.type ?? null,
    vendorType: "Supplier",
    supCode: r.supCode,
    vendorCode: r.supCode,
    rate: r.rate != null ? Number(r.rate) : null,
    proposedRate: r.proposedRate != null ? Number(r.proposedRate) : null,
    revNo: r.revNo,
    revDate: r.revDate,
    revStatus: r.revStatus,
    approvalStatus,
    approvalDate: r.approvalDate,
    submittedBy: r.submittedBy,
    submittedAt: r.submittedAt,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt,
    rejectedReason: r.rejectedReason,
    remarks: r.remarks,
    creatUserIdCd: r.creatUserIdCd,
    creatDt: r.creatDt,
  };
}

/**
 * GET /api/pricing
 * Source selection:
 * - PRICING_SOURCE=json → ESSKAY JSON export
 * - PRICING_SOURCE=db → TOOLS_PRICE_MASTER via Prisma
 * - unset → prefer DB when it has rows, else JSON fallback
 */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const forced = (process.env.PRICING_SOURCE ?? "").trim().toLowerCase();

  try {
    const useDb =
      forced === "db" ||
      (forced !== "json" &&
        (await prisma.toolsPriceMaster.count()) > 0);

    if (useDb) {
      const rows = await prisma.toolsPriceMaster.findMany({
        orderBy: { creatDt: "desc" },
        take: 5000,
        include: {
          tool: {
            select: {
              toolOrGaugeNo: true,
              name: true,
              grouping: true,
              type: true,
            },
          },
        },
      });

      const items = rows.map(mapPriceRow);

      return NextResponse.json({
        source: "db",
        readOnly: false,
        note: "Live TOOLS_PRICE_MASTER. Propose rate edits here; approve in Approval Centre. GRN still writes RATE directly.",
        total: items.length,
        items,
      });
    }

    const data = await loadEsskayPricing();
    return NextResponse.json({
      source: data.source,
      readOnly: true,
      note: "JSON fallback (set PRICING_SOURCE=db when Manpro has price rows).",
      exportedAt: data.exportedAt,
      total: data.count,
      items: data.items,
    });
  } catch (error) {
    console.error("Error fetching tools pricing:", error);
    return NextResponse.json({ items: [], error: "Failed to load pricing" }, { status: 500 });
  }
}

/**
 * POST /api/pricing — submit a proposed rate (PENDING). Does not overwrite live RATE.
 * Gate: canEditMaster OR canRaisePO (approvers use canApprovePricing separately).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const editOk = await requirePermission(authCheck.session, "canEditMaster");
  const poOk = await requirePermission(authCheck.session, "canRaisePO");
  if (!editOk.ok && !poOk.ok) {
    return editOk.ok === false ? editOk.response : poOk.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = PricingProposeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { rowId, toolRefNo, proposedRate, remarks } = parsed.data;
  const supCode = parsed.data.supCode?.trim() || null;
  const submittedBy = authCheck.session.userId.slice(0, 50);
  const now = new Date();

  try {
    if (rowId != null) {
      const existing = await prisma.toolsPriceMaster.findUnique({
        where: { rowId },
        include: {
          tool: {
            select: {
              toolOrGaugeNo: true,
              name: true,
              grouping: true,
              type: true,
            },
          },
        },
      });
      if (!existing) {
        return NextResponse.json({ error: "Price row not found" }, { status: 404 });
      }

      const updated = await prisma.toolsPriceMaster.update({
        where: { rowId },
        data: {
          proposedRate,
          approvalStatus: "PENDING",
          submittedBy,
          submittedAt: now,
          approvedBy: null,
          approvedAt: null,
          rejectedReason: null,
          remarks: remarks ?? existing.remarks,
          // live rate untouched
        },
        include: {
          tool: {
            select: {
              toolOrGaugeNo: true,
              name: true,
              grouping: true,
              type: true,
            },
          },
        },
      });

      return NextResponse.json({ ok: true, item: mapPriceRow(updated) });
    }

    // New pending row — RATE stays null until approved
    if (toolRefNo == null) {
      return NextResponse.json(
        { error: "toolRefNo is required when creating a new price row" },
        { status: 400 }
      );
    }

    const created = await prisma.toolsPriceMaster.create({
      data: {
        toolRefNo,
        supCode,
        rate: null,
        proposedRate,
        approvalStatus: "PENDING",
        submittedBy,
        submittedAt: now,
        remarks: remarks ?? null,
        creatUserIdCd: authCheck.session.userId.slice(0, 10),
        creatDt: now,
      },
      include: {
        tool: {
          select: {
            toolOrGaugeNo: true,
            name: true,
            grouping: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json(
      { ok: true, item: mapPriceRow(created) },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/pricing:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit pricing" },
      { status: 500 }
    );
  }
}
