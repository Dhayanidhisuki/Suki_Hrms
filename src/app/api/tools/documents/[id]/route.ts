import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { removeDocFile } from "@/lib/toolDocuments";
import { checkModulePermission } from "@/lib/rbac";

/** Soft-delete a document */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const calib = await checkModulePermission(authCheck.session, "tool_master", "DELETE");
  if (!calib.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const master = await checkModulePermission(authCheck.session, "tool_master", "EDIT");
  if (!master.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  if (!calib.allowed && !master.allowed) {
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
