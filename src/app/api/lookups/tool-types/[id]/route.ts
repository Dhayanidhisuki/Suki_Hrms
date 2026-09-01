import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { ToolsTypeSchema } from "@/lib/validators";
import { checkModulePermission } from "@/lib/rbac";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "tools_name_type", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = ToolsTypeSchema.partial().safeParse({
    ...body,
    typeOfTools: body.typeOfTools ?? body.name,
    itemGroupId: body.itemGroupId ?? body.groupId,
    itemTypeId: body.itemTypeId ?? body.typeId,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Lock name once used in Tools Manage (legacy ERP behavior)
    const existing = await prisma.toolsType.findUnique({ where: { rowId: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Tools name not found" }, { status: 404 });
    }

    if (
      parsed.data.typeOfTools &&
      existing.typeOfTools &&
      parsed.data.typeOfTools !== existing.typeOfTools
    ) {
      const used = await prisma.gaugeAndTools.count({
        where: { name: existing.typeOfTools },
      });
      if (used > 0) {
        return NextResponse.json(
          {
            error:
              "You can't update Tools Name because it is already used in Tools Manage creation.",
          },
          { status: 409 }
        );
      }
    }

    const item = await prisma.toolsType.update({
      where: { rowId: Number(id) },
      data: {
        typeOfTools: parsed.data.typeOfTools,
        itemGroupId: parsed.data.itemGroupId ?? parsed.data.groupId,
        itemTypeId: parsed.data.itemTypeId ?? parsed.data.typeId,
        isAutoGenCd: parsed.data.isAutoGenCd,
        prefixItemNo: parsed.data.prefixItemNo,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("Error updating tools name:", error);
    return NextResponse.json({ error: "Failed to update tools name" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "tools_name_type", "DELETE");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.toolsType.findUnique({ where: { rowId: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Tools name not found" }, { status: 404 });
    }

    if (existing.typeOfTools) {
      const used = await prisma.gaugeAndTools.count({
        where: { name: existing.typeOfTools },
      });
      if (used > 0) {
        return NextResponse.json(
          {
            error:
              "You can't delete Tools Name because it is already used in Tools Manage creation.",
          },
          { status: 409 }
        );
      }
    }

    await prisma.toolsType.delete({ where: { rowId: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting tools name:", error);
    return NextResponse.json({ error: "Failed to delete tools name" }, { status: 500 });
  }
}
