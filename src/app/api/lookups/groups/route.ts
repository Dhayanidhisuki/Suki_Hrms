import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";

function mapGroup(item: {
  rowId: number;
  otherType: string | null;
  prefixToolsNo: string | null;
  poPrefix: string | null;
  grnPrefix: string | null;
  indentPrefix: string | null;
  itemNoPrefixMod: string | null;
  prefixGateEntry: string | null;
  creatDt: Date | null;
  creatUserIdCd: string;
  lstUpdtUserIdCd: string | null;
  lstUpdtTs: Date | null;
}) {
  return {
    id: item.rowId,
    rowId: item.rowId,
    code: item.prefixToolsNo || `GRP-${item.rowId}`,
    name: item.otherType || "Unnamed Group",
    prefixToolsNo: item.prefixToolsNo,
    poPrefix: item.poPrefix,
    grnPrefix: item.grnPrefix,
    indentPrefix: item.indentPrefix,
    itemNoPrefixMod: item.itemNoPrefixMod || "Yes",
    prefixGateEntry: item.prefixGateEntry || "",
    createdDate: item.creatDt,
    updateBy: item.lstUpdtUserIdCd || item.creatUserIdCd,
  };
}

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rawItems = await prisma.otherToolsType.findMany({
      orderBy: { creatDt: "desc" },
      include: { subgroups: true },
    });

    return NextResponse.json({ items: rawItems.map(mapGroup) });
  } catch (error) {
    console.error("Error fetching tools groups:", error);
    return NextResponse.json({ items: [], error: "Failed to load tools groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();

  try {
    const item = await prisma.otherToolsType.create({
      data: {
        otherType: body.name || body.otherType,
        prefixToolsNo: body.prefixToolsNo || body.code,
        poPrefix: body.poPrefix,
        grnPrefix: body.grnPrefix,
        indentPrefix: body.indentPrefix,
        itemNoPrefixMod: body.itemNoPrefixMod || "Yes",
        prefixGateEntry: body.prefixGateEntry,
        creatUserIdCd: authCheck.session.userId,
        creatDt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, item: mapGroup(item) }, { status: 201 });
  } catch (error) {
    console.error("Error creating tools group:", error);
    return NextResponse.json({ error: "Failed to create tools group" }, { status: 500 });
  }
}
