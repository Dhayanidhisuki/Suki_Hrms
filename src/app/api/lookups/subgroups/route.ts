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

function mapSubgroup(item: {
  rowId: number;
  qmsOtherTypeOfTools: string | null;
  refGroupId: number | null;
  prefixToolsNo: string | null;
  isAutoGenCd: string | null;
  prefixBased: string | null;
  creatUserIdCd: string;
  creatDt: Date | null;
  lstUpdtUserIdCd: string | null;
  lstUpdtTs: Date | null;
  group?: { rowId: number; otherType: string | null; prefixToolsNo: string | null } | null;
}) {
  return {
    id: item.rowId,
    rowId: item.rowId,
    // Display-only, ROW_ID-derived (no stored "Subgroup Code" column exists).
    code: `SUB-${item.rowId}`,
    name: item.qmsOtherTypeOfTools || "Unnamed Subgroup",
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
  };
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rawItems = await prisma.qmsOtherToolsType.findMany({
      orderBy: { rowId: "desc" },
      include: { group: true },
    });

    return NextResponse.json({ items: rawItems.map(mapSubgroup) });
  } catch (error) {
    console.error("Error fetching tool subgroups:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load tool subgroups" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = QmsOtherToolsTypeSchema.safeParse({
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
    // QMS_OTHER_TOOLS_TYPE.ROW_ID is not identity in the ERP DB.
    const nextRowId =
      ((await prisma.qmsOtherToolsType.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;

    const item = await prisma.qmsOtherToolsType.create({
      data: {
        rowId: nextRowId,
        qmsOtherTypeOfTools: parsed.data.qmsOtherTypeOfTools,
        refGroupId: parsed.data.refGroupId,
        prefixToolsNo: parsed.data.prefixToolsNo || null,
        isAutoGenCd: parsed.data.isAutoGenCd ?? "No",
        prefixBased: parsed.data.prefixBased?.trim() || null,
        creatUserIdCd: erpUserId(authCheck.session.userId),
        creatDt: new Date(),
      },
      include: { group: true },
    });

    return NextResponse.json({ ok: true, item: mapSubgroup(item) }, { status: 201 });
  } catch (error) {
    console.error("Error creating tool subgroup:", error);
    return NextResponse.json({ error: "Failed to create tool subgroup" }, { status: 500 });
  }
}
