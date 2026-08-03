import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { ToolsTypeSchema } from "@/lib/validators";

function dbErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (/FOREIGN KEY/i.test(msg)) {
      return "Create blocked by ERP user FK — audit user could not be resolved.";
    }
    if (/Cannot insert the value NULL into column 'ROW_ID'/i.test(msg)) {
      return "TOOLS_TYPE.ROW_ID is not identity in ERP — failed to allocate id.";
    }
    if (/String or binary data would be truncated/i.test(msg)) {
      return "One or more fields exceed ERP column length.";
    }
    // Prefer the first SQL Server line when Prisma wraps it
    const sqlLine = msg.split("\n").find((l) => /^(Invalid|Cannot|The |Violation)/i.test(l.trim()));
    if (sqlLine) return sqlLine.trim().slice(0, 240);
  }
  return "Failed to create tools name";
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const [rawItems, groups, types] = await Promise.all([
      prisma.toolsType.findMany({ orderBy: { creatDt: "desc" } }),
      prisma.otherToolsType.findMany(),
      prisma.qmsOtherToolsType.findMany(),
    ]);

    const groupMap = new Map(groups.map((g) => [g.rowId, g.otherType || ""]));
    const typeMap = new Map(types.map((t) => [t.rowId, t.qmsOtherTypeOfTools || ""]));

    const items = rawItems.map((item) => ({
      id: item.rowId,
      rowId: item.rowId,
      name: item.typeOfTools || "",
      typeOfTools: item.typeOfTools || "",
      itemGroupId: item.itemGroupId,
      itemTypeId: item.itemTypeId,
      groupName: item.itemGroupId ? groupMap.get(item.itemGroupId) || "—" : "—",
      typeName: item.itemTypeId ? typeMap.get(item.itemTypeId) || "—" : "—",
      isAutoGenCd: item.isAutoGenCd || "No",
      prefixItemNo: item.prefixItemNo || "",
      creatUserIdCd: item.creatUserIdCd,
      creatDt: item.creatDt,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching tools names:", error);
    return NextResponse.json({ items: [], error: "Failed to load tools names" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = ToolsTypeSchema.safeParse({
    ...body,
    typeOfTools: body.typeOfTools || body.name,
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
    // CREAT_USER_ID_CD FK → ERP_USER. App login ids (e.g. "admin") are not valid.
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const isAutoGenCd = (parsed.data.isAutoGenCd || "Yes").slice(0, 3);
    const prefixItemNo = parsed.data.prefixItemNo?.trim()
      ? parsed.data.prefixItemNo.trim().slice(0, 15)
      : null;

    // Prefer identity default; if ERP ROW_ID is not identity, fall back to max+1.
    let item;
    try {
      item = await prisma.toolsType.create({
        data: {
          typeOfTools: parsed.data.typeOfTools,
          itemGroupId: parsed.data.itemGroupId ?? parsed.data.groupId,
          itemTypeId: parsed.data.itemTypeId ?? parsed.data.typeId,
          isAutoGenCd,
          prefixItemNo,
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });
    } catch (firstError) {
      const msg = firstError instanceof Error ? firstError.message : "";
      if (!/Cannot insert the value NULL into column 'ROW_ID'/i.test(msg)) {
        throw firstError;
      }
      const nextRowId =
        ((await prisma.toolsType.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
      item = await prisma.toolsType.create({
        data: {
          rowId: nextRowId,
          typeOfTools: parsed.data.typeOfTools,
          itemGroupId: parsed.data.itemGroupId ?? parsed.data.groupId,
          itemTypeId: parsed.data.itemTypeId ?? parsed.data.typeId,
          isAutoGenCd,
          prefixItemNo,
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        item: {
          id: item.rowId,
          rowId: item.rowId,
          name: item.typeOfTools,
          typeOfTools: item.typeOfTools,
          itemGroupId: item.itemGroupId,
          itemTypeId: item.itemTypeId,
          isAutoGenCd: item.isAutoGenCd,
          prefixItemNo: item.prefixItemNo,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tools name:", error);
    const actorMsg =
      error instanceof Error && /No valid ERP_USER/.test(error.message)
        ? error.message
        : dbErrorMessage(error);
    return NextResponse.json({ error: actorMsg }, { status: 500 });
  }
}
