import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  daysUntil,
  isAssetYes,
  preventiveDueStatus,
} from "@/lib/preventiveFlow";

/**
 * GET /api/tools/preventive-due
 * Assets (Is Asset = Yes) with unit NXT_PRE_DATE in the alert window, or never set.
 * No dedicated module UI required — used from master / history / overview.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const alertDays = Number(
    req.nextUrl.searchParams.get("alertDays") ??
      process.env.PREVENTIVE_ALERT_DAYS ??
      90
  );
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + alertDays);
  alertDate.setHours(23, 59, 59, 999);

  try {
    const tools = await prisma.gaugeAndTools.findMany({
      where: {
        OR: [
          { isAsset: { in: ["Yes", "Y", "YES"] } },
          { preventiveFrqMonths: { gt: 0 } },
        ],
      },
      select: {
        refNo: true,
        toolOrGaugeNo: true,
        name: true,
        grouping: true,
        type: true,
        status: true,
        isAsset: true,
        preventiveMethod: true,
        preventiveFrqMonths: true,
        serialNumbers: {
          select: {
            refNo: true,
            serialNo: true,
            status: true,
            nextPreDate: true,
            nextPreDone: true,
          },
          orderBy: { serialNo: "asc" },
        },
      },
      take: 500,
    });

    type Row = {
      toolRefNo: number;
      toolOrGaugeNo: string | null;
      name: string | null;
      grouping: string | null;
      type: string | null;
      toolStatus: string | null;
      isAsset: string | null;
      preventiveMethod: string | null;
      frequencyMonths: number | null;
      unitRefNo: number;
      serialNo: number | null;
      unitStatus: string | null;
      nextPreDate: Date | null;
      daysLeft: number | null;
      dueStatus: string;
    };

    const items: Row[] = [];
    for (const t of tools) {
      if (!isAssetYes(t.isAsset) && !(t.preventiveFrqMonths && t.preventiveFrqMonths > 0)) {
        continue;
      }
      const units =
        t.serialNumbers.length > 0
          ? t.serialNumbers
          : [
              {
                refNo: -t.refNo,
                serialNo: null as number | null,
                status: t.status,
                nextPreDate: null as Date | null,
                nextPreDone: null as number | null,
              },
            ];

      for (const u of units) {
        const next = u.nextPreDate;
        const include =
          next == null || next.getTime() <= alertDate.getTime();
        if (!include) continue;
        items.push({
          toolRefNo: t.refNo,
          toolOrGaugeNo: t.toolOrGaugeNo,
          name: t.name,
          grouping: t.grouping,
          type: t.type,
          toolStatus: t.status,
          isAsset: t.isAsset,
          preventiveMethod: t.preventiveMethod,
          frequencyMonths: t.preventiveFrqMonths,
          unitRefNo: u.refNo,
          serialNo: u.serialNo,
          unitStatus: u.status,
          nextPreDate: next,
          daysLeft: daysUntil(next),
          dueStatus: preventiveDueStatus(next, Math.min(30, alertDays)),
        });
      }
    }

    items.sort((a, b) => {
      const da = a.daysLeft ?? -99999;
      const db = b.daysLeft ?? -99999;
      return da - db;
    });

    return NextResponse.json({
      items: items.slice(0, 300),
      total: items.length,
      alertDays,
    });
  } catch (err) {
    console.error("preventive-due failed:", err);
    return NextResponse.json(
      { items: [], total: 0, error: "Failed to load preventive due list" },
      { status: 500 }
    );
  }
}
