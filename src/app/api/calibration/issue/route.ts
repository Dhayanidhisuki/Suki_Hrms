import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibIssueCreateSchema } from "@/lib/validators";

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
  if (!check.ok) return check.response;

  try {
    const statusFilter = req.nextUrl.searchParams.get("status");
    const awaitingReceive = req.nextUrl.searchParams.get("awaitingReceive") === "1";
    const raw = await prisma.toolsIssueForCalibration.findMany({
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
        if (awaitingReceive) {
          return item.status === "OPEN" || item.status === "PARTIAL";
        }
        if (statusFilter) return item.status === statusFilter;
        return true;
      });

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
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canManageCalibration");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = CalibIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { receiveName, subCode, issueDate, issueFor, toolsPoNo, lines } = parsed.data;

  try {
    // CREAT_USER_ID_CD FK → ERP_USER.USER_ID (app username "admin" is not an ERP user)
    const erpActor = await resolveErpAuditUserId(authCheck.session);

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
            issueQty: line.issueQty,
            serialNo: line.serialNo ?? null,
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
