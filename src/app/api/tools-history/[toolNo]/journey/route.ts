import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { loadToolJourney } from "@/lib/toolJourney";

/**
 * GET /api/tools-history/[toolNo]/journey
 * Merged chronological feed for History Card 360° Journey.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ toolNo: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { toolNo: raw } = await params;
  const toolNo = decodeURIComponent(raw || "").trim();
  if (!toolNo) {
    return NextResponse.json({ error: "toolNo is required" }, { status: 400 });
  }

  const refNoParam = Number(req.nextUrl.searchParams.get("refNo") || "");
  const refNo = Number.isFinite(refNoParam) && refNoParam > 0 ? refNoParam : null;

  try {
    const journey = await loadToolJourney(toolNo, { refNo });
    if (!journey) {
      return NextResponse.json({ error: `Tool not found: ${toolNo}` }, { status: 404 });
    }
    return NextResponse.json(journey);
  } catch (err) {
    console.error("GET /api/tools-history/[toolNo]/journey failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load journey" },
      { status: 500 }
    );
  }
}
