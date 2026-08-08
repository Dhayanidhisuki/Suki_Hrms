import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/po/spend?months=6
 * Monthly PO spend from COMMON_PURCHASE_ORDER (Tools + ERP created).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const months = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get("months") || 6)));
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));

  const rows = await prisma.$queryRawUnsafe<
    Array<{ ym: string; po_count: number; amount: number | null }>
  >(
    `SELECT
       CONVERT(char(7), PO_DATE, 126) AS ym,
       COUNT(*) AS po_count,
       SUM(ISNULL(PURCHASE_VALUE, 0)) AS amount
     FROM dbo.COMMON_PURCHASE_ORDER
     WHERE PO_DATE >= @p0
     GROUP BY CONVERT(char(7), PO_DATE, 126)
     ORDER BY ym`,
    start
  ).catch(async () => {
    // Prisma SQL Server often needs inline date for raw
    const iso = start.toISOString().slice(0, 10);
    return prisma.$queryRawUnsafe<
      Array<{ ym: string; po_count: number; amount: number | null }>
    >(
      `SELECT
         CONVERT(char(7), PO_DATE, 126) AS ym,
         COUNT(*) AS po_count,
         SUM(ISNULL(PURCHASE_VALUE, 0)) AS amount
       FROM dbo.COMMON_PURCHASE_ORDER
       WHERE PO_DATE >= '${iso}'
       GROUP BY CONVERT(char(7), PO_DATE, 126)
       ORDER BY ym`
    );
  });

  const byYm = new Map(
    rows.map((r) => [
      r.ym,
      {
        month: r.ym,
        poCount: Number(r.po_count) || 0,
        amount: Number(r.amount) || 0,
      },
    ])
  );

  const data: Array<{ month: string; poCount: number; amount: number }> = [];
  const cursor = new Date(start);
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = cursor.toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
    const hit = byYm.get(key);
    data.push({
      month: label,
      poCount: hit?.poCount ?? 0,
      amount: hit?.amount ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return NextResponse.json({ items: data, source: "COMMON_PURCHASE_ORDER" });
}
