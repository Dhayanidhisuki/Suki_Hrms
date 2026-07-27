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
  const refNo = Number(id);
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { refNo },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const serials = await prisma.gaugeSerialNo.findMany({
    where: { toolOrGaugeNo: tool.toolOrGaugeNo },
    orderBy: { creatDt: "asc" },
  });

  return NextResponse.json({ serials });
}
