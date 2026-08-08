import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

type LedgerRow = {
  code: string;
  ledgerName: string | null;
  accStatus: string | null;
  isPurchaserLedger: string | null;
};

/**
 * GET /api/gl-codes — list FINANCE_LEDGER_MASTER for EXP_LEDGER_CODE pickers.
 * Read-only (no POST — ERP owns ledger master).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const purchaserOnly =
    req.nextUrl.searchParams.get("purchaserOnly") !== "0" &&
    req.nextUrl.searchParams.get("purchaserOnly") !== "false";
  const search = (req.nextUrl.searchParams.get("search") || "").trim().slice(0, 50);
  const take = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") || 200)));

  try {
    const like = search ? `%${search}%` : null;
    const rows = await prisma.$queryRawUnsafe<LedgerRow[]>(
      `
      SELECT TOP (${take})
        LTRIM(RTRIM(CODE)) AS code,
        LEDGER_NAME AS ledgerName,
        ACC_STATUS AS accStatus,
        IS_PURCHASER_LEDGER AS isPurchaserLedger
      FROM dbo.FINANCE_LEDGER_MASTER
      WHERE CODE IS NOT NULL
        AND LTRIM(RTRIM(CODE)) <> ''
        ${
          purchaserOnly
            ? `AND UPPER(LTRIM(RTRIM(ISNULL(IS_PURCHASER_LEDGER, '')))) = 'YES'`
            : ""
        }
        ${like ? `AND (CODE LIKE @p0 OR LEDGER_NAME LIKE @p0)` : ""}
      ORDER BY CODE
      `.replace(/@p0/g, like ? `'${like.replace(/'/g, "''")}'` : "''")
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        code: r.code,
        ledgerName: r.ledgerName,
        accStatus: r.accStatus,
        isPurchaserLedger: r.isPurchaserLedger,
      })),
      source: "FINANCE_LEDGER_MASTER",
      readOnly: true,
    });
  } catch (err) {
    console.error("GET /api/gl-codes:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load ledger codes",
        items: [],
      },
      { status: 500 }
    );
  }
}
