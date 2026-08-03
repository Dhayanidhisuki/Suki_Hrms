import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    // Filter in the DB: with 13k+ tools, taking the first 500 alphabetically
    // and filtering afterwards would miss every tool that has an ROL set.
    const tools = await prisma.gaugeAndTools.findMany({
      where: { minOrderLevel: { gt: 0 } },
      orderBy: { toolOrGaugeNo: "asc" },
      take: 500,
      select: {
        refNo: true,
        toolOrGaugeNo: true,
        name: true,
        grouping: true,
        type: true,
        qtyIn: true,
        totQty: true,
        minOrderLevel: true,
        uom: true,
      },
    });

    const items = tools
      .map((t) => {
        const qtyIn = Number(t.qtyIn ?? 0);
        const rol = Number(t.minOrderLevel ?? 0);
        const belowRol = qtyIn <= rol;
        return {
          id: t.refNo,
          toolOrGaugeNo: t.toolOrGaugeNo,
          name: t.name,
          grouping: t.grouping,
          type: t.type,
          qtyIn,
          totQty: Number(t.totQty ?? 0),
          reorderLevel: rol,
          // GAUGEANDTOOLS.STATUS carries no signal — derive the state instead.
          status: belowRol ? "Below ROL" : "OK",
          uom: t.uom,
          belowRol,
        };
      })
      .sort((a, b) => Number(b.belowRol) - Number(a.belowRol));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching reorder levels:", error);
    return NextResponse.json({ items: [], error: "Failed to load reorder levels" }, { status: 500 });
  }
}
