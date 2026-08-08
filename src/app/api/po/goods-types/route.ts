import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** Goods-type options + ERP PO prefixes for Create PO UI. */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const rows = await prisma.otherToolsType.findMany({
    where: { poPrefix: { not: null } },
    orderBy: { otherType: "asc" },
    select: {
      rowId: true,
      otherType: true,
      poPrefix: true,
      issueType: true,
    },
  });

  const items = rows
    .filter((r) => r.otherType && r.poPrefix)
    .map((r) => ({
      rowId: r.rowId,
      goodsType: r.otherType!,
      poPrefix: r.poPrefix!,
      issueType: r.issueType,
    }));

  return NextResponse.json({ items });
}
