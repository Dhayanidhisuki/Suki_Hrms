import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { ToolsIssueUpdateSchema } from "@/lib/validators";

const OPEN_STATUSES = ["Active", "OPEN", "Open", "PARTIAL"];

function maintainsSerial(flag: string | null | undefined): boolean {
  const v = (flag ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "1" || v === "true";
}

function isOpenStatus(status: string | null | undefined): boolean {
  return OPEN_STATUSES.includes(status ?? "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const issue = await prisma.gaugeToolsIssue.findUnique({
    where: { dcNo: id },
    include: {
      lines: { include: { tool: true } },
      receivedHeaders: { include: { lines: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json({ issue });
}

/**
 * PUT /api/issue/[id]
 * Update header (and optional line remarks) on an open DC.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canCreateIssue");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const body = await req.json();
  const parsed = ToolsIssueUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.gaugeToolsIssue.findUnique({
    where: { dcNo: id },
    include: { receivedHeaders: { select: { recNo: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }
  if (!isOpenStatus(existing.status)) {
    return NextResponse.json(
      { error: `DC ${id} is not open for edit (status: ${existing.status})` },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const opt = (data.issueOption ?? existing.issueOption ?? "").toLowerCase();
  const nextCust =
    data.custCode !== undefined ? data.custCode : existing.custCode;
  if (opt === "customer" && !(nextCust ?? "").toString().trim()) {
    return NextResponse.json(
      { error: "custCode is required when issueOption is Customer" },
      { status: 400 }
    );
  }

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const issue = await prisma.$transaction(async (tx) => {
      const header = await tx.gaugeToolsIssue.update({
        where: { dcNo: id },
        data: {
          ...(data.receiveName !== undefined ? { receiveName: data.receiveName } : {}),
          ...(data.receiveNameTwo !== undefined ? { receiveNameTwo: data.receiveNameTwo } : {}),
          ...(data.subCode !== undefined ? { subCode: data.subCode } : {}),
          ...(data.supCode !== undefined ? { supCode: data.supCode } : {}),
          ...(data.custCode !== undefined ? { custCode: data.custCode } : {}),
          ...(data.empId !== undefined ? { empId: data.empId } : {}),
          ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
          ...(data.issueOption !== undefined ? { issueOption: data.issueOption } : {}),
          ...(data.dcRefNo !== undefined ? { dcRefNo: data.dcRefNo } : {}),
          ...(data.returnable !== undefined ? { returnable: data.returnable } : {}),
          ...(data.transportName !== undefined ? { transportName: data.transportName } : {}),
          ...(data.vehicleNo !== undefined ? { vehicleNo: data.vehicleNo } : {}),
          ...(data.comments !== undefined ? { comments: data.comments } : {}),
          ...(data.lobType !== undefined ? { lobType: data.lobType } : {}),
          ...(data.poOrderNo !== undefined ? { poOrderNo: data.poOrderNo } : {}),
          ...(data.fromUnit !== undefined ? { fromUnit: data.fromUnit } : {}),
          ...(data.itemType !== undefined ? { itemType: data.itemType } : {}),
          ...(data.issuePurpose !== undefined ? { issuePurpose: data.issuePurpose } : {}),
          ...(data.matType !== undefined ? { matType: data.matType } : {}),
          lstUpdtUserIdCd: erpActor,
        },
      });

      if (data.lines?.length) {
        for (const line of data.lines) {
          await tx.toolsTransIssue.updateMany({
            where: { rowId: line.rowId, dcNo: id },
            data: {
              ...(line.remarks !== undefined ? { remarks: line.remarks } : {}),
              ...(line.machine !== undefined ? { machine: line.machine } : {}),
              ...(line.processName !== undefined ? { processName: line.processName } : {}),
            },
          });
        }
      }

      return header;
    });

    return NextResponse.json({ ok: true, issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/issue/[id]
 * Soft-cancel open DC (status=Cancelled) and restore stock for non-serial tools.
 * Blocked if any receive GRN already exists against the DC.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canCreateIssue");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    await prisma.$transaction(async (tx) => {
      const issue = await tx.gaugeToolsIssue.findUnique({
        where: { dcNo: id },
        include: {
          lines: true,
          receivedHeaders: { select: { recNo: true } },
        },
      });
      if (!issue) throw new Error("Issue not found");
      if (!isOpenStatus(issue.status)) {
        throw new Error(`DC ${id} is not open (status: ${issue.status})`);
      }
      if (issue.receivedHeaders.length > 0) {
        throw new Error(
          `DC ${id} already has receive GRN(s) — cancel is not allowed`
        );
      }
      const isMovementRecord =
        issue.issueOption === "Internal Unit Movement" ||
        issue.issueOption?.startsWith("External:") ||
        issue.lines.some((line) => Boolean(line.issueToItemNo));

      for (const line of issue.lines) {
        const toolNo = line.toolOrGaugeNo;
        if (!toolNo) continue;
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: toolNo },
        });
        if (!tool) continue;
        const qty = Number(line.issueQty ?? 0);
        if (!isMovementRecord && qty > 0 && !maintainsSerial(tool.serialNoGenReq)) {
          await tx.gaugeAndTools.update({
            where: { toolOrGaugeNo: toolNo },
            data: {
              qtyIn: { increment: qty },
              qtyOut: { decrement: qty },
              lstUpdtUserIdCd: erpActor,
            },
          });
        }
        if (isMovementRecord) {
          await tx.gaugeSerialNo.updateMany({
            where: {
              toolOrGaugeNo: toolNo,
              ...(line.serialNo != null
                ? { serialNo: line.serialNo }
                : { status: { in: ["IN MOVEMENT", "VENDOR USE"] } }),
            },
            data: { status: "AVAILABLE FOR USE" },
          });
          if (issue.fromUnit && line.issueToItemNo) {
            const sourceRackPrefix = "Source rack/location: ";
            const sourceRack = line.remarks?.startsWith(sourceRackPrefix)
              ? line.remarks.slice(sourceRackPrefix.length).trim() || null
              : null;
            await tx.gaugeAndTools.update({
              where: { refNo: tool.refNo },
              data: {
                locationName: issue.fromUnit,
                location: sourceRack,
                rack: sourceRack,
                locationOutputName: sourceRack
                  ? `${issue.fromUnit} / ${sourceRack}`
                  : `${issue.fromUnit} / Unassigned rack`,
                lstUpdtUserIdCd: erpActor,
              },
            });
          }
        }
        await tx.toolsTransIssue.update({
          where: { rowId: line.rowId },
          data: { status: "Cancelled" },
        });
      }

      await tx.gaugeToolsIssue.update({
        where: { dcNo: id },
        data: {
          status: "Cancelled",
          lstUpdtUserIdCd: erpActor,
        },
      });
    });

    return NextResponse.json({ ok: true, dcNo: id, status: "Cancelled" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    const status = message === "Issue not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
