import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";

type MonthCell = { plan: boolean; actual: boolean };
type CalendarRow = {
  toolOrGaugeNo: string;
  name: string | null;
  grouping: string | null;
  type: string | null;
  kind: "Calibration" | "Preventive";
  months: Record<number, MonthCell>;
};

function emptyMonths(): Record<number, MonthCell> {
  const m: Record<number, MonthCell> = {};
  for (let i = 1; i <= 12; i++) m[i] = { plan: false, actual: false };
  return m;
}

function monthInYear(d: Date | null | undefined, year: number): number | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year) return null;
  return d.getMonth() + 1;
}

/**
 * GET /api/calibration/calendar
 * Year × item Plan/Actual for Calibration and/or Preventive MNT.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const unitScope = await resolveUnitScope(session);

  const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
  const issueFor = (req.nextUrl.searchParams.get("issueFor") ?? "ALL").trim();
  const grouping = (req.nextUrl.searchParams.get("grouping") ?? "").trim();
  const type = (req.nextUrl.searchParams.get("type") ?? "").trim();
  const fromMonth = Math.max(1, Math.min(12, Number(req.nextUrl.searchParams.get("fromMonth") ?? 1)));
  const toMonth = Math.max(fromMonth, Math.min(12, Number(req.nextUrl.searchParams.get("toMonth") ?? 12)));

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const includeCalib = issueFor === "ALL" || /calib/i.test(issueFor);
  const includePm = issueFor === "ALL" || /prevent/i.test(issueFor);

  const toolWhere = {
    ...(grouping ? { grouping: { contains: grouping } } : {}),
    ...(type ? { type: { contains: type } } : {}),
  };

  const map = new Map<string, CalendarRow>();

  const ensure = (
    toolNo: string,
    meta: { name: string | null; grouping: string | null; type: string | null },
    kind: "Calibration" | "Preventive"
  ) => {
    const key = `${kind}::${toolNo}`;
    let row = map.get(key);
    if (!row) {
      row = {
        toolOrGaugeNo: toolNo,
        name: meta.name,
        grouping: meta.grouping,
        type: meta.type,
        kind,
        months: emptyMonths(),
      };
      map.set(key, row);
    }
    return row;
  };

  try {
    if (includeCalib) {
      const cards = await prisma.gaugeControlCard.findMany({
        where: {
          toolOrGaugeNo: { not: "" },
          ...(grouping || type
            ? {
                tool: toolWhere,
              }
            : {}),
        },
        take: 800,
        select: {
          toolOrGaugeNo: true,
          tool: { select: { name: true, grouping: true, type: true } },
          history: {
            orderBy: { cDate: "desc" },
            take: 36,
            select: { cDate: true, nextCDate: true },
          },
        },
      });

      for (const c of cards) {
        if (grouping && c.tool?.grouping !== grouping && !(c.tool?.grouping || "").includes(grouping)) {
          continue;
        }
        if (type && c.tool?.type !== type && !(c.tool?.type || "").includes(type)) {
          continue;
        }
        const row = ensure(c.toolOrGaugeNo, {
          name: c.tool?.name ?? null,
          grouping: c.tool?.grouping ?? null,
          type: c.tool?.type ?? null,
        }, "Calibration");
        const latestNext = c.history.find((h) => h.nextCDate)?.nextCDate;
        const planM = monthInYear(latestNext, year);
        if (planM) row.months[planM].plan = true;
        for (const h of c.history) {
          const am = monthInYear(h.cDate, year);
          if (am) row.months[am].actual = true;
          const pm = monthInYear(h.nextCDate, year);
          if (pm) row.months[pm].plan = true;
        }
      }

      // Supplement plan/actual from calib issue lines
      const lines = await prisma.toolsTransIssueForCalibration.findMany({
        where: {
          toolOrGaugeNo: { not: null },
          OR: [
            {
              nxtCalibDate: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`),
              },
            },
            {
              calibDueDate: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`),
              },
            },
            {
              calibratedDate: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`),
              },
            },
          ],
        },
        take: 2000,
        select: {
          toolOrGaugeNo: true,
          nxtCalibDate: true,
          calibDueDate: true,
          calibratedDate: true,
          tool: { select: { name: true, grouping: true, type: true } },
        },
      });

      for (const l of lines) {
        if (!l.toolOrGaugeNo) continue;
        if (grouping && !(l.tool?.grouping || "").includes(grouping) && l.tool?.grouping !== grouping) continue;
        if (type && !(l.tool?.type || "").includes(type) && l.tool?.type !== type) continue;
        const row = ensure(l.toolOrGaugeNo, {
          name: l.tool?.name ?? null,
          grouping: l.tool?.grouping ?? null,
          type: l.tool?.type ?? null,
        }, "Calibration");
        const planM = monthInYear(l.nxtCalibDate ?? l.calibDueDate, year);
        if (planM) row.months[planM].plan = true;
        const actM = monthInYear(l.calibratedDate, year);
        if (actM) row.months[actM].actual = true;
      }
    }

    if (includePm) {
      const units = await prisma.gaugeSerialNo.findMany({
        where: {
          OR: [{ nextPreDate: { not: null } }, { nextPreDone: 1 }],
          ...(grouping || type
            ? { tool: toolWhere }
            : {}),
        },
        take: 1500,
        select: {
          toolOrGaugeNo: true,
          nextPreDate: true,
          nextPreDone: true,
          tool: {
            select: {
              name: true,
              grouping: true,
              type: true,
              preventiveFrqMonths: true,
            },
          },
        },
      });

      for (const u of units) {
        const toolNo = u.toolOrGaugeNo;
        if (!toolNo) continue;
        if (grouping && !(u.tool?.grouping || "").includes(grouping)) continue;
        if (type && !(u.tool?.type || "").includes(type)) continue;
        const row = ensure(toolNo, {
          name: u.tool?.name ?? null,
          grouping: u.tool?.grouping ?? null,
          type: u.tool?.type ?? null,
        }, "Preventive");
        const planM = monthInYear(u.nextPreDate, year);
        if (planM) row.months[planM].plan = true;
        // Approximate last PM actual = next due − frequency when marked done
        if (u.nextPreDone === 1 && u.nextPreDate && u.tool?.preventiveFrqMonths) {
          const last = new Date(u.nextPreDate);
          last.setMonth(last.getMonth() - u.tool.preventiveFrqMonths);
          const actM = monthInYear(last, year);
          if (actM) row.months[actM].actual = true;
        }
      }
    }

    if (!unitScope.unrestricted) {
      const toolNos = [...map.values()].map((row) => row.toolOrGaugeNo);
      const tools = toolNos.length
        ? await prisma.gaugeAndTools.findMany({
            where: { toolOrGaugeNo: { in: toolNos } },
            select: { toolOrGaugeNo: true, locationName: true },
          })
        : [];
      const allowed = new Set(
        tools.filter((tool) => unitIsAllowed(unitScope, tool.locationName)).map((tool) => tool.toolOrGaugeNo)
      );
      for (const [key, row] of map) {
        if (!allowed.has(row.toolOrGaugeNo)) map.delete(key);
      }
    }

    let items = Array.from(map.values()).sort((a, b) =>
      a.toolOrGaugeNo.localeCompare(b.toolOrGaugeNo)
    );

    // Trim months outside from–to for export clarity (cells still full year; UI can hide)
    items = items.map((row) => {
      const months = emptyMonths();
      for (let m = fromMonth; m <= toMonth; m++) {
        months[m] = row.months[m];
      }
      // Keep out-of-range months empty (no markers) so export matches filter
      return { ...row, months };
    });

    // Drop rows with no markers in filtered months
    items = items.filter((row) => {
      for (let m = fromMonth; m <= toMonth; m++) {
        if (row.months[m]?.plan || row.months[m]?.actual) return true;
      }
      return false;
    });

    return NextResponse.json({
      year,
      fromMonth,
      toMonth,
      issueFor,
      items: items.slice(0, 500),
      total: items.length,
    });
  } catch (err) {
    console.error("calibration calendar failed:", err);
    return NextResponse.json(
      { error: "Failed to load calibration calendar", items: [] },
      { status: 500 }
    );
  }
}
