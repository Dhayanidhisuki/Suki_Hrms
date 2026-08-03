import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { OtherToolsTypeSchema } from "@/lib/validators";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const body = await req.json();
  const parsed = OtherToolsTypeSchema.partial().safeParse({
    ...body,
    otherType: body.otherType ?? body.name,
    prefixToolsNo: body.prefixToolsNo ?? body.code,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.otherToolsType.update({
      where: { rowId: Number(id) },
      data: {
        otherType: parsed.data.otherType,
        prefixToolsNo: parsed.data.prefixToolsNo,
        poPrefix: parsed.data.poPrefix,
        grnPrefix: parsed.data.grnPrefix,
        indentPrefix: parsed.data.indentPrefix,
        itemNoPrefixMod: parsed.data.itemNoPrefixMod,
        prefixGateEntry: parsed.data.prefixGateEntry,
        serialNoGenReq: parsed.data.serialNoGenReq,
        issueType: parsed.data.issueType,
        lstUpdtUserIdCd: authCheck.session.userId,
        lstUpdtTs: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: item.rowId,
        rowId: item.rowId,
        code: item.prefixToolsNo || `GRP-${item.rowId}`,
        name: item.otherType,
        prefixToolsNo: item.prefixToolsNo,
        poPrefix: item.poPrefix,
        grnPrefix: item.grnPrefix,
        indentPrefix: item.indentPrefix,
        itemNoPrefixMod: item.itemNoPrefixMod,
        prefixGateEntry: item.prefixGateEntry,
        createdDate: item.creatDt,
        updateBy: item.lstUpdtUserIdCd || item.creatUserIdCd,
      },
    });
  } catch (error) {
    console.error("Error updating tools group:", error);
    return NextResponse.json({ error: "Failed to update tools group" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canDeleteMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  await prisma.otherToolsType.delete({ where: { rowId: Number(id) } });
  return NextResponse.json({ ok: true });
}
