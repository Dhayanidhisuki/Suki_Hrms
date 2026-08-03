import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { ToolsReceiveCreateSchema } from "@/lib/validators";

const OPEN_STATUSES = ["OPEN", "PARTIAL", "Active"] as const;

const toolPreview = {
  select: {
    toolOrGaugeNo: true,
    name: true,
    description: true,
    type: true,
    grouping: true,
    uom: true,
  },
} as const;

/** GET — history GRNs by default; ?open=1 returns open issue DCs for receive picker. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const openPicker = searchParams.get("open") === "1" || searchParams.get("history") !== "1";
  // Default = open issue DCs (existing callers). Receive list page passes history=1 for GRNs.
  const search = (searchParams.get("search") ?? "").trim();
  const subCode = (searchParams.get("subCode") ?? "").trim();
  const vendorType = (searchParams.get("vendorType") ?? "").trim();
  const fromDate = (searchParams.get("fromDate") ?? "").trim();
  const toDate = (searchParams.get("toDate") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const skip = (page - 1) * pageSize;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (openPicker) {
      const where = {
        status: { in: [...OPEN_STATUSES] },
        AND: [
          search
            ? {
                OR: [
                  { dcNo: { contains: search } },
                  { receiveName: { contains: search } },
                  { subCode: { contains: search } },
                ],
              }
            : {},
          subCode && subCode !== "ALL" ? { subCode } : {},
          fromDate ? { issueDate: { gte: new Date(fromDate) } } : {},
          toDate
            ? {
                issueDate: {
                  lte: new Date(`${toDate}T23:59:59.999`),
                },
              }
            : {},
        ],
      };

      const [items, total, pendingTotal, overdueTotal] = await Promise.all([
        prisma.gaugeToolsIssue.findMany({
          where,
          include: {
            lines: { include: { tool: toolPreview, toolByRef: toolPreview } },
          },
          orderBy: { issueDate: "desc" },
          take: pageSize,
          skip,
        }),
        prisma.gaugeToolsIssue.count({ where }),
        prisma.gaugeToolsIssue.count({
          where: { status: { in: [...OPEN_STATUSES] } },
        }),
        prisma.gaugeToolsIssue.count({
          where: {
            status: { in: [...OPEN_STATUSES] },
            dueDate: { lt: today },
          },
        }),
      ]);

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
        pendingTotal,
        overdueTotal,
        mode: "open",
      });
    }

    // GRN history list (TOOLS_ISSUE_RECEIVED) — ERP receive list page
    const where = {
      AND: [
        search
          ? {
              OR: [
                { dcNo: { contains: search } },
                { partyDcNo: { contains: search } },
                { subCode: { contains: search } },
                { contName: { contains: search } },
                { creatUserIdCd: { contains: search } },
              ],
            }
          : {},
        subCode && subCode !== "ALL" ? { subCode } : {},
        vendorType && vendorType !== "ALL" ? { vendorType } : {},
        fromDate ? { receiveDate: { gte: new Date(fromDate) } } : {},
        toDate
          ? { receiveDate: { lte: new Date(`${toDate}T23:59:59.999`) } }
          : {},
      ],
    };

    const [rows, total, pendingTotal, overdueTotal] = await Promise.all([
      prisma.toolsIssueReceived.findMany({
        where,
        include: {
          lines: { include: { tool: toolPreview } },
          issueHeader: {
            select: {
              dcNo: true,
              receiveName: true,
              subCode: true,
              issueDate: true,
            },
          },
        },
        orderBy: { receiveDate: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.toolsIssueReceived.count({ where }),
      prisma.gaugeToolsIssue.count({
        where: { status: { in: [...OPEN_STATUSES] } },
      }),
      prisma.gaugeToolsIssue.count({
        where: {
          status: { in: [...OPEN_STATUSES] },
          dueDate: { lt: today },
        },
      }),
    ]);

    const items = rows.flatMap((r) => {
      if (!r.lines.length) {
        return [
          {
            recNo: r.recNo,
            grnNo: r.recNo,
            receiveDate: r.receiveDate,
            dcNo: r.dcNo,
            receivedFrom: r.contName || r.issueHeader?.receiveName || null,
            partyDcNo: r.partyDcNo,
            receivedBy: r.creatUserIdCd,
            subCode: r.subCode,
            vendorType: r.vendorType,
            location: r.location,
            poOrderNo: r.poOrderNo,
            status: r.status,
            grouping: null,
            type: null,
            toolOrGaugeNo: null,
            serialNo: null,
            description: null,
            qty: null,
          },
        ];
      }
      return r.lines.map((line) => ({
        recNo: r.recNo,
        grnNo: r.recNo,
        receiveDate: r.receiveDate,
        dcNo: r.dcNo,
        receivedFrom: r.contName || r.issueHeader?.receiveName || null,
        partyDcNo: r.partyDcNo,
        receivedBy: r.creatUserIdCd,
        subCode: r.subCode,
        vendorType: r.vendorType,
        location: r.location,
        poOrderNo: r.poOrderNo,
        status: line.status || r.status,
        grouping: line.tool?.grouping ?? null,
        type: line.tool?.type ?? null,
        toolOrGaugeNo: line.toolOrGaugeNo || line.tool?.toolOrGaugeNo || null,
        serialNo: line.serialNo,
        description: line.tool?.description || line.tool?.name || null,
        qty: line.quantity != null ? Number(line.quantity) : null,
      }));
    });

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      pendingTotal,
      overdueTotal,
      mode: "history",
    });
  } catch (error) {
    console.error("Error fetching receive records:", error);
    return NextResponse.json({
      items: [],
      total: 0,
      page: 1,
      pageSize,
      pendingTotal: 0,
      overdueTotal: 0,
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canReceiveTool");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = ToolsReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    dcNo,
    receiveDate,
    subCode,
    partyDcNo,
    contName,
    vendorType,
    poOrderNo,
    location,
    geNo,
    remarks,
    lines,
  } = parsed.data;

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const result = await prisma.$transaction(async (tx) => {
      const issueHeader = await tx.gaugeToolsIssue.findUnique({
        where: { dcNo },
        include: { lines: true },
      });
      if (!issueHeader) {
        throw new Error(`Issue DC ${dcNo} not found`);
      }
      if (!OPEN_STATUSES.includes(issueHeader.status as (typeof OPEN_STATUSES)[number])) {
        throw new Error(`Issue DC ${dcNo} is not open for receive (status: ${issueHeader.status})`);
      }

      const resolvedSub =
        (subCode?.trim() || issueHeader.subCode?.trim() || "GENERAL").slice(0, 10);

      const nextRecNo =
        ((await tx.toolsIssueReceived.aggregate({ _max: { recNo: true } }))._max.recNo ?? 0) + 1;

      const header = await tx.toolsIssueReceived.create({
        data: {
          recNo: nextRecNo,
          dcNo,
          receiveDate: new Date(receiveDate),
          subCode: resolvedSub,
          partyDcNo: partyDcNo?.slice(0, 15) || null,
          contName: contName?.slice(0, 80) || issueHeader.receiveName?.slice(0, 80) || null,
          vendorType: vendorType?.slice(0, 50) || issueHeader.issueOption?.slice(0, 50) || "SubContractor",
          poOrderNo: poOrderNo?.slice(0, 15) || null,
          location: location?.slice(0, 50) || null,
          geNo: geNo?.slice(0, 20) || null,
          status: "Active",
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });

      let nextRowId =
        ((await tx.toolsIssueReceivedTrans.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) +
        1;

      let totalReturning = 0;

      for (const line of lines) {
        const issueLine = issueHeader.lines.find((l) => l.rowId === line.issueRowId);
        if (!issueLine || issueLine.dcNo !== dcNo) {
          throw new Error(`No issue line #${line.issueRowId} found on DC ${dcNo}`);
        }

        const issuedQty = Number(issueLine.issueQty ?? 0);
        if (line.quantity > issuedQty) {
          throw new Error(
            `Return qty ${line.quantity} exceeds issued ${issuedQty} on line #${line.issueRowId}`
          );
        }

        let toolNo =
          line.toolOrGaugeNo?.trim() ||
          issueLine.toolOrGaugeNo?.trim() ||
          null;

        if (!toolNo && issueLine.toolRefNo && issueLine.toolRefNo > 0) {
          const byRef = await tx.gaugeAndTools.findUnique({
            where: { refNo: issueLine.toolRefNo },
            select: { toolOrGaugeNo: true },
          });
          toolNo = byRef?.toolOrGaugeNo ?? null;
        }

        const master = toolNo
          ? await tx.gaugeAndTools.findUnique({ where: { toolOrGaugeNo: toolNo } })
          : null;

        await tx.toolsIssueReceivedTrans.create({
          data: {
            rowId: nextRowId++,
            recNo: header.recNo,
            toolOrGaugeNo: toolNo,
            serialNo: issueLine.serialNo,
            quantity: line.quantity,
            status: line.status?.slice(0, 30) || "Received",
            comments: (line.comments || remarks)?.slice(0, 30) || null,
            toolRefNo:
              issueLine.toolRefNo && issueLine.toolRefNo > 0
                ? issueLine.toolRefNo
                : master?.refNo,
            toolIssRefNo: issueLine.rowId,
            creatUserIdCd: erpActor,
            creatDt: new Date(),
          },
        });

        // Mirror issue rule: only adjust stock when serials are NOT maintained
        const serialFlag = (master?.serialNoGenReq ?? "").trim().toLowerCase();
        const maintainsSerial =
          serialFlag === "yes" || serialFlag === "y" || serialFlag === "1" || serialFlag === "true";

        if (master && toolNo && !maintainsSerial) {
          await tx.gaugeAndTools.update({
            where: { toolOrGaugeNo: toolNo },
            data: {
              qtyIn: { increment: line.quantity },
              qtyOut: { decrement: line.quantity },
              lstUpdtUserIdCd: erpActor,
            },
          });
        }

        totalReturning += line.quantity;
      }

      const totalIssued = issueHeader.lines.reduce(
        (sum, l) => sum + Number(l.issueQty ?? 0),
        0
      );
      const nextStatus = totalReturning >= totalIssued ? "Closed" : "PARTIAL";

      await tx.gaugeToolsIssue.update({
        where: { dcNo },
        data: { status: nextStatus, lstUpdtUserIdCd: erpActor },
      });

      return { header, status: nextStatus };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
