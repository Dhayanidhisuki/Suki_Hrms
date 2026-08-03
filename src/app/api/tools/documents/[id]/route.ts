import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { removeDocFile } from "@/lib/toolDocuments";

/** Soft-delete a document */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const calib = await requirePermission(authCheck.session, "canManageCalibration");
  const master = await requirePermission(authCheck.session, "canEditMaster");
  if (!calib.ok && !master.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await prisma.toolDocument.findFirst({
    where: { id: docId, deletedAt: null },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await prisma.toolDocument.update({
    where: { id: docId },
    data: { deletedAt: new Date() },
  });

  // Best-effort physical remove
  await removeDocFile(doc.toolOrGaugeNo, doc.storedName);

  return NextResponse.json({ ok: true });
}
