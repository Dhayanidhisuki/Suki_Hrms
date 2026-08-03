import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const [tools, issues, groups] = await Promise.all([
      prisma.gaugeAndTools.findMany({
        orderBy: { creatDt: "desc" },
        take: 50,
        select: {
          refNo: true,
          toolOrGaugeNo: true,
          name: true,
          creatUserIdCd: true,
          creatDt: true,
          lstUpdtUserIdCd: true,
        },
      }),
      prisma.gaugeToolsIssue.findMany({
        orderBy: { creatDt: "desc" },
        take: 50,
        select: {
          dcNo: true,
          receiveName: true,
          creatUserIdCd: true,
          creatDt: true,
          lstUpdtUserIdCd: true,
        },
      }),
      prisma.otherToolsType.findMany({
        orderBy: { creatDt: "desc" },
        take: 50,
        select: {
          rowId: true,
          otherType: true,
          creatUserIdCd: true,
          creatDt: true,
          lstUpdtUserIdCd: true,
          lstUpdtTs: true,
        },
      }),
    ]);

    const items = [
      ...tools.map((t) => ({
        entity: "GAUGEANDTOOLS",
        key: t.toolOrGaugeNo ?? String(t.refNo),
        label: t.name ?? t.toolOrGaugeNo ?? String(t.refNo),
        createdBy: t.creatUserIdCd,
        createdAt: t.creatDt,
        updatedBy: t.lstUpdtUserIdCd,
        updatedAt: null as string | null,
      })),
      ...issues.map((i) => ({
        entity: "GAUGE_TOOLS_ISSUE",
        key: i.dcNo,
        label: i.receiveName ?? i.dcNo,
        createdBy: i.creatUserIdCd,
        createdAt: i.creatDt,
        updatedBy: i.lstUpdtUserIdCd,
        updatedAt: null as string | null,
      })),
      ...groups.map((g) => ({
        entity: "OTHER_TOOLS_TYPE",
        key: String(g.rowId),
        label: g.otherType ?? `Group ${g.rowId}`,
        createdBy: g.creatUserIdCd,
        createdAt: g.creatDt,
        updatedBy: g.lstUpdtUserIdCd,
        updatedAt: g.lstUpdtTs,
      })),
    ].sort((a, b) => {
      const da = a.updatedAt || a.createdAt;
      const db = b.updatedAt || b.createdAt;
      return new Date(db ?? 0).getTime() - new Date(da ?? 0).getTime();
    });

    return NextResponse.json({ items: items.slice(0, 100) });
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return NextResponse.json({ items: [], error: "Failed to load audit trail" }, { status: 500 });
  }
}
