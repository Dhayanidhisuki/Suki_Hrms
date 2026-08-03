import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";

/**
 * DELETE /api/tools-mapping/[id]
 * Remove a TOOLS_MAPPING row by ROW_ID.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return NextResponse.json({ error: "Invalid mapping id" }, { status: 400 });
  }

  const existing = await prisma.toolsMapping.findUnique({ where: { rowId } });
  if (!existing) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  await prisma.toolsMapping.delete({ where: { rowId } });
  return NextResponse.json({ ok: true });
}
