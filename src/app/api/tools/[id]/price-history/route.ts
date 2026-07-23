import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { id: Number(id) },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const history = await prisma.toolsPriceMaster.findMany({
    where: { toolOrGaugeNo: tool.toolOrGaugeNo },
    orderBy: { effectiveDate: "desc" },
    include: { tool: { select: { name: true } } },
  });

  return NextResponse.json({ history });
}
