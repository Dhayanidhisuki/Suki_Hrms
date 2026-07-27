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
  const grn = await prisma.toolsPoReceive.findUnique({
    where: { girNo: Number(id) },
    include: { lines: { include: { tool: true } }, supplier: true },
  });

  if (!grn) {
    return NextResponse.json({ error: "GRN not found" }, { status: 404 });
  }

  return NextResponse.json({ grn });
}
