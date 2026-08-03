import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { loadEsskayPricing } from "@/lib/esskayPricing";

/**
 * GET /api/pricing
 * Temporary: serve TOOLS_PRICE_MASTER from the ESSKAY export
 * (ERPDb_Manpro.TOOLS_PRICE_MASTER is empty; ERPDb_ESSKAY is not on this server).
 */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const data = await loadEsskayPricing();
    return NextResponse.json({
      source: data.source,
      exportedAt: data.exportedAt,
      total: data.count,
      items: data.items,
    });
  } catch (error) {
    console.error("Error fetching tools pricing:", error);
    return NextResponse.json({ items: [], error: "Failed to load pricing" }, { status: 500 });
  }
}
