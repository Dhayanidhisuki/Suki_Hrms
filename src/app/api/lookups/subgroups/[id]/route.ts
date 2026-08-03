import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { QmsOtherToolsTypeSchema } from "@/lib/validators";

/** ERP audit columns are NVarChar(10). */
function erpUserId(userId: string) {
  return userId.slice(0, 10);
}

/** The legacy UI saved its dropdown placeholder as data — treat it as empty. */
function stripPlaceholder(value: string | null): string | null {
  if (!value) return null;
  return value.trim() === "-Select-" ? null : value;
}

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
  const parsed = QmsOtherToolsTypeSchema.partial().safeParse({
    ...body,
    qmsOtherTypeOfTools: body.qmsOtherTypeOfTools ?? body.name,
    // Legacy alias used by the combined Lookups screen.
    prefixToolsNo: body.prefixToolsNo ?? body.code,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.qmsOtherToolsType.update({
      where: { rowId: Number(id) },
      data: {
        qmsOtherTypeOfTools: parsed.data.qmsOtherTypeOfTools,
        refGroupId: parsed.data.refGroupId,
        prefixToolsNo: parsed.data.prefixToolsNo,
        isAutoGenCd: parsed.data.isAutoGenCd,
        prefixBased:
          parsed.data.prefixBased !== undefined
            ? parsed.data.prefixBased.trim() || null
            : undefined,
        lstUpdtUserIdCd: erpUserId(authCheck.session.userId),
        lstUpdtTs: new Date(),
      },
      include: { group: true },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: item.rowId,
        rowId: item.rowId,
        code: `SUB-${item.rowId}`,
        name: item.qmsOtherTypeOfTools,
        refGroupId: item.refGroupId,
        prefixToolsNo: item.prefixToolsNo,
        isAutoGenCd: item.isAutoGenCd,
        prefixBased: stripPlaceholder(item.prefixBased),
        creatUserIdCd: item.creatUserIdCd,
        creatDt: item.creatDt,
        lstUpdtUserIdCd: item.lstUpdtUserIdCd,
        lstUpdtTs: item.lstUpdtTs,
        group: item.group
          ? {
              id: item.group.rowId,
              code: `GRP-${item.group.rowId}`,
              name: item.group.otherType || "",
              prefixToolsNo: item.group.prefixToolsNo,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error updating tool subgroup:", error);
    return NextResponse.json({ error: "Failed to update tool subgroup" }, { status: 500 });
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
  await prisma.qmsOtherToolsType.delete({ where: { rowId: Number(id) } });
  return NextResponse.json({ ok: true });
}
