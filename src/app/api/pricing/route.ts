import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { loadEsskayPricing } from "@/lib/esskayPricing";

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

      const items = rows.map((r) => ({
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
        revNo: r.revNo,
        revDate: r.revDate,
        revStatus: r.revStatus,
        approvalStatus: r.approvalStatus,
        approvalDate: r.approvalDate,
        remarks: r.remarks,
        creatUserIdCd: r.creatUserIdCd,
        creatDt: r.creatDt,
      }));

      return NextResponse.json({
        source: "db",
        readOnly: true,
        note: "Live TOOLS_PRICE_MASTER. Create/edit rates via GRN/ERP for now.",
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
