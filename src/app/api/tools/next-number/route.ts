import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  formatNextToolNo,
  parsePrefixedToolNo,
  resolveToolNumberPrefix,
  stripPlaceholder,
} from "@/lib/toolCreate";

/**
 * Suggest the next TOOL_OR_GAUGE_NO for a group/type prefix.
 * Query: ?groupPrefix=OTH_J&typePrefix=OTH_C&prefixBased=Group&isAutoGenCd=Yes
 *    or: ?prefix=OTH_J
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const sp = req.nextUrl.searchParams;
  const prefix =
    stripPlaceholder(sp.get("prefix")) ||
    resolveToolNumberPrefix({
      groupPrefix: sp.get("groupPrefix"),
      typePrefix: sp.get("typePrefix"),
      prefixBased: sp.get("prefixBased"),
      isAutoGenCd: sp.get("isAutoGenCd"),
    });

  if (!prefix) {
    return NextResponse.json(
      { error: "prefix or groupPrefix is required" },
      { status: 400 }
    );
  }

  const cleanPrefix = prefix.replace(/-+$/, "").toUpperCase();
  if (!/^[A-Z0-9_]+$/i.test(cleanPrefix)) {
    return NextResponse.json({ error: "Invalid prefix" }, { status: 400 });
  }

  try {
    const matches = await prisma.$queryRawUnsafe<
      Array<{ TOOL_OR_GAUGE_NO: string }>
    >(
      `SELECT TOOL_OR_GAUGE_NO FROM GAUGEANDTOOLS
       WHERE TOOL_OR_GAUGE_NO LIKE '${cleanPrefix}%'`
    );

    let maxSeq = 0;
    let width = 5;
    for (const row of matches) {
      const parsed = parsePrefixedToolNo(row.TOOL_OR_GAUGE_NO);
      if (!parsed) continue;
      if (parsed.prefix.toUpperCase() !== cleanPrefix) continue;
      if (parsed.seq > maxSeq) {
        maxSeq = parsed.seq;
        width = Math.max(width, parsed.width);
      }
    }

    const nextSeq = maxSeq + 1;
    const toolOrGaugeNo = formatNextToolNo(cleanPrefix, nextSeq, width);
    const autoFlag = (sp.get("isAutoGenCd") || "").toUpperCase();
    const isAuto = autoFlag === "YES" || autoFlag === "Y";

    return NextResponse.json({
      prefix: cleanPrefix,
      nextSeq,
      width,
      toolOrGaugeNo,
      autoSuggested: isAuto || maxSeq > 0,
    });
  } catch (error) {
    console.error("GET /api/tools/next-number failed:", error);
    return NextResponse.json(
      { error: "Failed to compute next tool number" },
      { status: 500 }
    );
  }
}
