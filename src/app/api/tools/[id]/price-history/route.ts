import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const refNo = Number(id);
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { refNo },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }
  const unitScope = await resolveUnitScope(check.session);
  if (!unitIsAllowed(unitScope, tool.locationName)) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const history = await prisma.toolsPriceMaster.findMany({
    where: { toolRefNo: refNo },
    orderBy: { revDate: "desc" },
  });

  return NextResponse.json({ history });
}
