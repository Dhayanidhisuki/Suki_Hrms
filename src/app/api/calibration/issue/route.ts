import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibIssueCreateSchema } from "@/lib/validators";
import { normalizeCompanyUnit } from "@/lib/companyUnits";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";
import { checkModulePermission } from "@/lib/rbac";

function isCalibIssueLineOpen(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return (
    !s ||
    s === "ISSUED" ||
    s === "OPEN" ||
    s === "UNDER CALIBRATION" ||
    s.includes("ISSUE FOR CALIBRATION") ||
    s === "PENDING"
  );
}

function isCalibIssueLineReceived(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "RECEIVED" || s === "CLOSED" || s.includes("RECEIVED");
}

/** Header status from line receive state (supports partial receive). */
function deriveHeaderStatus(item: {
  receiveHeaders?: { recNo: number }[];
  inHouseLines?: { resultStatus: string | null; status: string | null }[];
}): "OPEN" | "PARTIAL" | "CLOSED" {
  const lines = item.inHouseLines ?? [];
  if (lines.length === 0) {
    return (item.receiveHeaders?.length ?? 0) > 0 ? "CLOSED" : "OPEN";
  }
  const openCount = lines.filter((l) => isCalibIssueLineOpen(l.status)).length;
  const receivedCount = lines.filter((l) => isCalibIssueLineReceived(l.status)).length;
  if (openCount === 0) return "CLOSED";
  if (receivedCount > 0 && openCount > 0) return "PARTIAL";
  return "OPEN";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const unitScope = await resolveUnitScope(session);

  try {
    const statusFilter = req.nextUrl.searchParams.get("status");
    const awaitingReceive = req.nextUrl.searchParams.get("awaitingReceive") === "1";
    const issueFor = (req.nextUrl.searchParams.get("issueFor") ?? "").trim();
    const party = (req.nextUrl.searchParams.get("party") ?? "").trim();
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
    const fromDate = (req.nextUrl.searchParams.get("fromDate") ?? "").trim();
    const toDate = (req.nextUrl.searchParams.get("toDate") ?? "").trim();

    const where = {
      AND: [
        issueFor && issueFor !== "ALL" ? { issueFor: { contains: issueFor } } : {},
        party
          ? {
              OR: [
                { receiveName: { contains: party } },
                { subCode: { contains: party } },
              ],
            }
          : {},
        search
          ? {
              OR: [
                { receiveName: { contains: search } },
                { subCode: { contains: search } },
                { toolsPoNo: { contains: search } },
                { issueFor: { contains: search } },
              ],
            }
          : {},
        fromDate ? { issueDate: { gte: new Date(fromDate) } } : {},
        toDate
          ? { issueDate: { lte: new Date(`${toDate}T23:59:59.999`) } }
          : {},
      ],
    };

    const raw = await prisma.toolsIssueForCalibration.findMany({
      where,
      include: {
        inHouseLines: { include: { tool: true } },
        receiveHeaders: { select: { recNo: true } },
      },
      orderBy: { creatDt: "desc" },
      take: 200,
    });

    const items = raw
      .map((item) => {
        const status = deriveHeaderStatus(item);
        const openLines = (item.inHouseLines ?? []).filter((l) =>
          isCalibIssueLineOpen(l.status)
        );
        return {
          ...item,
          status,
          // Receive picker only needs still-out lines
          inHouseLines: awaitingReceive ? openLines : item.inHouseLines,
        };
      })
      .filter((item) => {
        if (!unitScope.unrestricted && !item.inHouseLines.some((line) => unitIsAllowed(unitScope, line.tool?.locationName))) return false;
        if (awaitingReceive) {
          return item.status === "OPEN" || item.status === "PARTIAL";
        }
        if (statusFilter) return item.status === statusFilter;
        return true;
      });

    // Attach latest lab rate from TOOLS_PRICE_MASTER for receive prefill
    if (awaitingReceive && items.length > 0) {
      const refNos = Array.from(
        new Set(
          items.flatMap((item) =>
            (item.inHouseLines ?? [])
              .map((l) => l.tool?.refNo ?? l.toolRefNo)
              .filter((n): n is number => typeof n === "number")
          )
        )
      );
      const rateByRef = new Map<number, number>();
      if (refNos.length > 0) {
        try {
          const rates = await prisma.toolsPriceMaster.findMany({
            where: { toolRefNo: { in: refNos } },
            orderBy: [{ revDate: "desc" }, { creatDt: "desc" }],
            select: { toolRefNo: true, rate: true },
          });
          for (const row of rates) {
            if (row.toolRefNo == null || rateByRef.has(row.toolRefNo)) continue;
            const rate = Number(row.rate);
            if (Number.isFinite(rate) && rate > 0) rateByRef.set(row.toolRefNo, rate);
          }
        } catch (err) {
          console.warn("Price master enrichment skipped:", err);
        }
      }

      for (const item of items) {
        item.inHouseLines = (item.inHouseLines ?? []).map((line) => {
          const ref = line.tool?.refNo ?? line.toolRefNo;
          const labRate = ref != null ? rateByRef.get(ref) ?? null : null;
          return {
            ...line,
            tool: line.tool ? { ...line.tool, labRate } : line.tool,
          };
        });
      }
    }

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error("Error fetching calibration issues:", error);
    return NextResponse.json(
      { items: [], error: "Failed to load calibration issues" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "calibration_issue", "CREATE");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const unitScope = await resolveUnitScope(authCheck.session);

  const body = await req.json();
  const parsed = CalibIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { receiveName, subCode, issueDate, issueFor, toolsPoNo, lines } = parsed.data;

  try {
    // CREAT_USER_ID_CD FK → ERP_USER.USER_ID (app username "admin" is not an ERP user)
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const toolNos = [...new Set(lines.map((line) => line.toolOrGaugeNo.trim()))];
    const selectedTools = await prisma.gaugeAndTools.findMany({
      where: { toolOrGaugeNo: { in: toolNos } },
      select: { toolOrGaugeNo: true, locationName: true, status: true },
    });
    if (selectedTools.length !== toolNos.length) {
      const found = new Set(selectedTools.map((tool) => tool.toolOrGaugeNo));
      const missing = toolNos.find((toolNo) => !found.has(toolNo));
      return NextResponse.json({ error: `Instrument not found: ${missing ?? "—"}` }, { status: 400 });
    }
    const selectedUnits = new Set(selectedTools.map((tool) => normalizeCompanyUnit(tool.locationName)));
      if (!selectedTools.every((tool) => unitIsAllowed(unitScope, tool.locationName))) {
        return NextResponse.json({ error: "You do not have access to one or more instrument units" }, { status: 403 });
      }
    if (selectedUnits.has(null) || selectedUnits.size !== 1) {
      return NextResponse.json(
        { error: "A calibration DC can contain instruments from one company unit only" },
        { status: 400 }
      );
    }
    const unavailable = selectedTools.find((tool) =>
      ["UNDER CALIBRATION", "IN MOVEMENT", "VENDOR USE", "INHOUSE USE"].includes(
        (tool.status || "").trim().toUpperCase()
      )
    );
    if (unavailable) {
      return NextResponse.json(
        { error: `${unavailable.toolOrGaugeNo} is not available for calibration issue (${unavailable.status || "Unknown status"})` },
        { status: 409 }
      );
    }
    const openExisting = await prisma.toolsTransIssueForCalibration.findFirst({
      where: {
        toolOrGaugeNo: { in: toolNos },
        OR: [
          { resultStatus: null },
          { resultStatus: "" },
          { calibrationStatus: { in: ["Pending", "PENDING", "Open", "OPEN"] } },
          { status: { in: ["Issued", "Under Calibration", "ISSUE FOR CALIBRATION", "Received"] } },
        ],
      },
      select: { toolOrGaugeNo: true, dcNo: true },
    });
    if (openExisting?.toolOrGaugeNo) {
      return NextResponse.json(
        { error: `${openExisting.toolOrGaugeNo} is already open on calibration DC #${openExisting.dcNo ?? "—"}` },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const max = await tx.toolsIssueForCalibration.aggregate({ _max: { dcNo: true } });
      const dcNo = (max._max.dcNo ?? 0) + 1;

      const header = await tx.toolsIssueForCalibration.create({
        data: {
          dcNo,
          receiveName: receiveName?.slice(0, 25) || null,
          subCode: subCode?.slice(0, 10) || null,
          issueDate: new Date(issueDate),
          issueFor: issueFor?.slice(0, 25) || "Calibration",
          toolsPoNo: toolsPoNo?.slice(0, 20) || null,
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });

      let nextRowId =
        ((await tx.toolsTransIssueForCalibration.aggregate({ _max: { rowId: true } }))
          ._max.rowId ?? 0) + 1;

      for (const line of lines) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
        });

        await tx.toolsTransIssueForCalibration.create({
          data: {
            rowId: nextRowId++,
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            issueQty: 1,
            serialNo: null,
            grouping: tool?.grouping?.slice(0, 25) ?? null,
            calibDueDate: line.calibDueDate ? new Date(line.calibDueDate) : null,
            dueDate: line.calibDueDate ? new Date(line.calibDueDate) : null,
            status: "ISSUE FOR CALIBRATION",
            calibrationStatus: "Pending",
            toolRefNo: tool?.refNo ?? null,
            creatUserIdCd: erpActor,
            creatDt: new Date(),
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
          data: {
            status: "Under Calibration",
            lstUpdtUserIdCd: erpActor,
          },
        });

      }

      return header;
    });

    return NextResponse.json(
      { ok: true, item: { ...result, status: "OPEN" }, header: result },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
