import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibIssueUpdateSchema } from "@/lib/validators";
import { normalizeCompanyUnit } from "@/lib/companyUnits";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";

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
  const done = lines.filter((l) => String(l.resultStatus ?? "").trim()).length;
  if (openCount === 0 || (done > 0 && done === lines.length)) return "CLOSED";
  if ((receivedCount > 0 && openCount > 0) || (done > 0 && done < lines.length)) return "PARTIAL";
  return "OPEN";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const unitScope = await resolveUnitScope(check.session);
  const issue = await prisma.toolsIssueForCalibration.findUnique({
    where: { dcNo: Number(id) },
    include: {
      inHouseLines: { include: { tool: true } },
      receiveHeaders: { include: { lines: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Calibration issue not found" }, { status: 404 });
  }
  if (!issue.inHouseLines.some((line) => unitIsAllowed(unitScope, line.tool?.locationName))) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const status = deriveHeaderStatus(issue);
  return NextResponse.json({ issue: { ...issue, status } });
}

/**
 * PUT /api/calibration/issue/[id]
 * Edit open/partial calib DC header fields.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canManageCalibration");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const dcNo = Number(id);
  if (!Number.isFinite(dcNo)) {
    return NextResponse.json({ error: "Invalid DC No" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = CalibIssueUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.toolsIssueForCalibration.findUnique({
    where: { dcNo },
    include: {
      inHouseLines: { include: { tool: { select: { locationName: true } } } },
      receiveHeaders: { include: { lines: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Calibration issue not found" }, { status: 404 });
  }
  const unitScope = await resolveUnitScope(authCheck.session);
  if (!existing.inHouseLines.every((line) => unitIsAllowed(unitScope, line.tool?.locationName))) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const status = deriveHeaderStatus(existing);
  if (status === "CLOSED") {
    return NextResponse.json(
      { error: `DC ${dcNo} is closed and cannot be edited` },
      { status: 400 }
    );
  }

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);
    const data = parsed.data;
    const issue = await prisma.$transaction(async (tx) => {
      if (data.lines) {
        const processingStarted = existing.receiveHeaders.length > 0 || existing.inHouseLines.some(
          (line) => Boolean(line.resultStatus?.trim() || isCalibIssueLineReceived(line.status))
        );
        if (processingStarted) {
          throw new Error(`DC ${dcNo} line items cannot be changed after calibration receipt or processing has started`);
        }
        const toolNos = data.lines.map((line) => line.toolOrGaugeNo.trim());
        if (new Set(toolNos.map((value) => value.toUpperCase())).size !== toolNos.length) {
          throw new Error("The same instrument cannot appear more than once on a calibration DC");
        }

        const existingById = new Map(existing.inHouseLines.map((line) => [line.rowId, line]));
        const dcUnit = normalizeCompanyUnit(
          existing.inHouseLines.find((line) => line.tool?.locationName)?.tool?.locationName
        );
        if (!dcUnit) {
          throw new Error(`DC ${dcNo} has no valid source unit and its line items cannot be changed`);
        }
        for (const line of data.lines) {
          if (line.rowId != null) {
            const saved = existingById.get(line.rowId);
            if (!saved || saved.toolOrGaugeNo !== line.toolOrGaugeNo) {
              throw new Error(`Invalid calibration DC line: ${line.toolOrGaugeNo}`);
            }
          }
        }

        const keptIds = new Set(data.lines.flatMap((line) => line.rowId == null ? [] : [line.rowId]));
        const removed = existing.inHouseLines.filter((line) => !keptIds.has(line.rowId));
        const added = data.lines.filter((line) => line.rowId == null);
        const receivedLines = existing.receiveHeaders.flatMap((header) => header.lines);

        for (const line of removed) {
          const wasReceived = receivedLines.some((received) =>
            received.toolOrGaugeNo === line.toolOrGaugeNo &&
            (line.serialNo == null || received.serialNo == null || received.serialNo === line.serialNo)
          );
          const processed = Boolean(
            wasReceived || line.resultStatus?.trim() || isCalibIssueLineReceived(line.status)
          );
          if (processed) {
            // Preserve the ERP calibration/result history keyed by ROW_ID, but
            // detach the line from this DC so revised views/PDFs omit it.
            await tx.toolsTransIssueForCalibration.update({
              where: { rowId: line.rowId },
              data: { dcNo: null },
            });
          } else {
            await tx.toolsTransIssueForCalibration.delete({ where: { rowId: line.rowId } });
          }
          if (!processed && line.toolOrGaugeNo) {
            await tx.gaugeAndTools.update({
              where: { toolOrGaugeNo: line.toolOrGaugeNo },
              data: { status: "Available", lstUpdtUserIdCd: erpActor },
            });
          }
        }

        let nextRowId =
          ((await tx.toolsTransIssueForCalibration.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;
        for (const line of added) {
          const tool = await tx.gaugeAndTools.findUnique({
            where: { toolOrGaugeNo: line.toolOrGaugeNo },
          });
          if (!tool) throw new Error(`Instrument not found: ${line.toolOrGaugeNo}`);
          if (normalizeCompanyUnit(tool.locationName) !== dcUnit) {
            throw new Error(`${line.toolOrGaugeNo} belongs to ${tool.locationName || "an unknown unit"}. Only ${dcUnit} instruments can be added to this DC`);
          }
          if (["UNDER CALIBRATION", "IN MOVEMENT", "VENDOR USE", "INHOUSE USE"].includes((tool.status || "").trim().toUpperCase())) {
            throw new Error(`${line.toolOrGaugeNo} is not currently available (${tool.status || "Unknown status"})`);
          }
          const otherOpen = await tx.toolsTransIssueForCalibration.findFirst({
            where: {
              toolOrGaugeNo: line.toolOrGaugeNo,
              dcNo: { not: dcNo },
              AND: [
                { OR: [{ resultStatus: null }, { resultStatus: "" }] },
                { OR: [
                  { calibrationStatus: { in: ["Pending", "PENDING", "Open", "OPEN"] } },
                  { status: { in: ["ISSUED", "OPEN", "Under Calibration", "ISSUE FOR CALIBRATION"] } },
                ] },
              ],
            },
            select: { dcNo: true },
          });
          if (otherOpen) {
            throw new Error(`${line.toolOrGaugeNo} is already open on calibration DC #${otherOpen.dcNo ?? "—"}`);
          }
          await tx.toolsTransIssueForCalibration.create({
            data: {
              rowId: nextRowId++,
              dcNo,
              toolOrGaugeNo: line.toolOrGaugeNo,
              issueQty: 1,
              grouping: tool.grouping?.slice(0, 25) ?? null,
              calibDueDate: line.calibDueDate ? new Date(line.calibDueDate) : null,
              dueDate: line.calibDueDate ? new Date(line.calibDueDate) : null,
              status: "ISSUE FOR CALIBRATION",
              calibrationStatus: "Pending",
              toolRefNo: tool.refNo,
              creatUserIdCd: erpActor,
              creatDt: new Date(),
            },
          });
          await tx.gaugeAndTools.update({
            where: { toolOrGaugeNo: line.toolOrGaugeNo },
            data: { status: "Under Calibration", lstUpdtUserIdCd: erpActor },
          });
        }
      }

      await tx.toolsIssueForCalibration.update({
        where: { dcNo },
        data: {
          ...(data.receiveName !== undefined ? { receiveName: data.receiveName } : {}),
          ...(data.subCode !== undefined ? { subCode: data.subCode } : {}),
          ...(data.issueDate !== undefined ? { issueDate: new Date(data.issueDate) } : {}),
          ...(data.issueFor !== undefined ? { issueFor: data.issueFor } : {}),
          ...(data.toolsPoNo !== undefined ? { toolsPoNo: data.toolsPoNo } : {}),
          lstUpdtUserIdCd: erpActor,
        },
      });

      return tx.toolsIssueForCalibration.findUniqueOrThrow({
        where: { dcNo },
        include: { inHouseLines: { include: { tool: true }, orderBy: { rowId: "asc" } } },
      });
    });
    return NextResponse.json({ ok: true, issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
