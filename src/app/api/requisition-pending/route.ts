import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { MaterialRequisitionCreateSchema } from "@/lib/validators";

/** ERP-style Req No: MRS/25-26-000001 (Indian FY Apr–Mar) */
async function generateMrsReqNo(
  tx: Prisma.TransactionClient
): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const fyStart = now.getMonth() >= 3 ? y : y - 1;
  const fyLabel = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
  const prefix = `MRS/${fyLabel}-`;

  const existing = await tx.materialRequisitionMaster.findMany({
    where: { reqNo: { startsWith: prefix } },
    select: { reqNo: true },
    take: 5000,
  });
  let max = 0;
  for (const r of existing) {
    const m = r.reqNo?.match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

function toNum(v: Prisma.Decimal | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function isPendingStatus(status: string | null | undefined) {
  const s = String(status ?? "").trim().toUpperCase();
  if (!s) return true;
  return (
    s.includes("PEND") ||
    s.includes("OPEN") ||
    s === "NEW" ||
    s === "RAISED" ||
    s === "SUBMITTED" ||
    s === "ACTIVE"
  );
}

function isStillOpenLine(opts: {
  lineStatus: string | null | undefined;
  headerStatus: string | null | undefined;
  reqQty: number;
  issueQty: number;
}) {
  // Qty fully issued → fulfilled even if status string lagged behind
  if (opts.reqQty > 0 && opts.issueQty >= opts.reqQty) return false;
  if (opts.issueQty <= 0) return true;
  if (opts.reqQty > 0 && opts.issueQty < opts.reqQty) return true;
  return isPendingStatus(opts.lineStatus) || isPendingStatus(opts.headerStatus);
}

/** Match DC comments written as `Req:{reqNo}` or `Req:{reqNo} | …` */
function dcMatchesReqNo(comments: string | null | undefined, reqNo: string) {
  const c = (comments ?? "").trim();
  const prefix = `Req:${reqNo}`;
  return c === prefix || c.startsWith(`${prefix} |`) || c.startsWith(`${prefix}|`);
}

/**
 * Reconcile MATERIAL_REQUISITION_* ISSUE_QTY / STATUS from Tool Issue DCs
 * that were saved with Requisition Pending (comments start with Req:{reqNo}).
 * Heals cases where the DC was created but MR write-back was skipped/missed.
 */
async function reconcileRequisitionsFromIssueDcs(
  reqNos: string[],
  erpActor = "SYSTEM"
) {
  const unique = [...new Set(reqNos.map((n) => n.trim()).filter(Boolean))];
  for (const reqNo of unique) {
    const candidates = await prisma.gaugeToolsIssue.findMany({
      where: { comments: { startsWith: `Req:${reqNo}` } },
      select: { dcNo: true, comments: true },
      take: 200,
    });
    const dcNos = candidates
      .filter((d) => dcMatchesReqNo(d.comments, reqNo))
      .map((d) => d.dcNo);
    if (dcNos.length === 0) continue;

    const issueLines = await prisma.toolsTransIssue.findMany({
      where: { dcNo: { in: dcNos } },
      select: { toolOrGaugeNo: true, issueQty: true },
    });
    const issuedByTool = new Map<string, number>();
    for (const il of issueLines) {
      const key = (il.toolOrGaugeNo ?? "").trim().toUpperCase();
      if (!key) continue;
      issuedByTool.set(key, (issuedByTool.get(key) ?? 0) + toNum(il.issueQty));
    }
    if (issuedByTool.size === 0) continue;

    const reqLines = await prisma.materialRequisitionTrans.findMany({
      where: { reqNo },
    });
    for (const rl of reqLines) {
      const key = (rl.toolOrGaugeNo ?? "").trim().toUpperCase();
      if (!key) continue;
      const fromDcs = issuedByTool.get(key) ?? 0;
      const current = toNum(rl.issueQty);
      if (fromDcs <= current) continue;
      const reqQty = toNum(rl.reqQty);
      const fulfilled = reqQty > 0 && fromDcs >= reqQty;
      await prisma.materialRequisitionTrans.update({
        where: { rowId: rl.rowId },
        data: {
          issueQty: fromDcs,
          status: fulfilled ? "CLOSED" : "OPEN",
          lstUpdtUserIdCd: erpActor,
          lstUpdtTs: new Date(),
        },
      });
    }

    // Always re-sync header STATUS + ISSUE_QTY from lines (even if lines were already correct)
    const refreshed = await prisma.materialRequisitionTrans.findMany({
      where: { reqNo },
    });
    if (refreshed.length === 0) continue;
    const allFulfilled = refreshed.every((l) => {
      const rq = toNum(l.reqQty);
      const iq = toNum(l.issueQty);
      return rq > 0 && iq >= rq;
    });
    const headerIssued = refreshed.reduce((s, l) => s + toNum(l.issueQty), 0);
    await prisma.materialRequisitionMaster.updateMany({
      where: { reqNo },
      data: {
        status: allFulfilled ? "CLOSED" : "OPEN",
        issueQty: headerIssued,
        lstUpdtUserIdCd: erpActor,
        lstUpdtTs: new Date(),
      },
    });
  }
}

/**
 * GET — pending tool requisition lines from MATERIAL_REQUISITION_*.
 * Only lines with TOOL_GAUGE_NO. Default view = still open / unfulfilled.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") ?? "").trim();
  const statusFilter = (searchParams.get("status") ?? "pending").trim().toLowerCase();
  /** ERP header Status filter: OPEN | CLOSED | ALL (optional; combines with pending/fulfilled) */
  const headerStatus = (searchParams.get("headerStatus") ?? "").trim().toUpperCase();
  const reqNoExact = (searchParams.get("reqNo") ?? "").trim();
  const fromDate = (searchParams.get("fromDate") ?? "").trim();
  const toDate = (searchParams.get("toDate") ?? "").trim();
  /** ERP Cons.Dt? — Yes = apply From/To on header date; No = ignore dates */
  const considerDate = (searchParams.get("considerDate") ?? "No").trim().toLowerCase() === "yes";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));

  try {
    const toolLineWhere: Prisma.MaterialRequisitionTransWhereInput = {
      AND: [
        { toolOrGaugeNo: { not: null } },
        { NOT: { toolOrGaugeNo: "" } },
        reqNoExact ? { reqNo: reqNoExact } : {},
        search
          ? {
              OR: [
                { reqNo: { contains: search } },
                { toolOrGaugeNo: { contains: search } },
                { descrip: { contains: search } },
                { remarks: { contains: search } },
                { machine: { contains: search } },
              ],
            }
          : {},
      ],
    };

    let lines = await prisma.materialRequisitionTrans.findMany({
      where: toolLineWhere,
      orderBy: [{ creatDt: "desc" }, { rowId: "desc" }],
      take: 500,
    });

    // Heal MR ISSUE_QTY/STATUS from Issue DCs tagged Req:{reqNo}
    const reqNosToHeal = [
      ...new Set(
        reqNoExact
          ? [reqNoExact]
          : lines.map((l) => l.reqNo).filter((n): n is string => Boolean(n))
      ),
    ].slice(0, 40);
    if (reqNosToHeal.length > 0) {
      await reconcileRequisitionsFromIssueDcs(reqNosToHeal);
      lines = await prisma.materialRequisitionTrans.findMany({
        where: toolLineWhere,
        orderBy: [{ creatDt: "desc" }, { rowId: "desc" }],
        take: 500,
      });
    }

    const reqNos = [
      ...new Set(lines.map((l) => l.reqNo).filter((n): n is string => Boolean(n))),
    ];

    const headerWhere: Prisma.MaterialRequisitionMasterWhereInput = {
      AND: [
        reqNos.length > 0 ? { reqNo: { in: reqNos } } : { reqNo: "__none__" },
        headerStatus === "OPEN"
          ? {
              OR: [
                { status: { contains: "OPEN" } },
                { status: { contains: "Open" } },
                { status: { contains: "PEND" } },
                { status: null },
                { status: "" },
              ],
            }
          : headerStatus === "CLOSED"
            ? {
                OR: [
                  { status: { contains: "CLOSED" } },
                  { status: { contains: "Closed" } },
                ],
              }
            : {},
        considerDate && fromDate
          ? { reqDate: { gte: new Date(`${fromDate}T00:00:00`) } }
          : {},
        considerDate && toDate
          ? { reqDate: { lte: new Date(`${toDate}T23:59:59.999`) } }
          : {},
      ],
    };

    const headers =
      reqNos.length > 0
        ? await prisma.materialRequisitionMaster.findMany({
            where: headerWhere,
            orderBy: { reqDate: "desc" },
          })
        : [];

    const headerByReq = new Map<string, (typeof headers)[number]>();
    for (const h of headers) {
      if (h.reqNo) headerByReq.set(h.reqNo, h);
    }

    const toolNos = [
      ...new Set(
        lines
          .map((l) => l.toolOrGaugeNo?.trim())
          .filter((n): n is string => Boolean(n))
      ),
    ];
    const tools =
      toolNos.length > 0
        ? await prisma.gaugeAndTools.findMany({
            where: { toolOrGaugeNo: { in: toolNos } },
            select: {
              toolOrGaugeNo: true,
              name: true,
              grouping: true,
              status: true,
            },
          })
        : [];
    const toolByNo = new Map(tools.map((t) => [t.toolOrGaugeNo, t]));

    // When header filters (OPEN/CLOSED/date) are applied, only keep lines whose header matched
    const allowedReqNos =
      headerStatus || (considerDate && (fromDate || toDate))
        ? new Set(headers.map((h) => h.reqNo).filter((n): n is string => Boolean(n)))
        : null;

    const mapped = lines
      .filter((line) => !allowedReqNos || (line.reqNo != null && allowedReqNos.has(line.reqNo)))
      .map((line) => {
      const header = line.reqNo ? headerByReq.get(line.reqNo) : undefined;
      const reqQty = toNum(line.reqQty);
      const issueQty = toNum(line.issueQty);
      const pending = isStillOpenLine({
        lineStatus: line.status,
        headerStatus: header?.status,
        reqQty,
        issueQty,
      });
      const tool = line.toolOrGaugeNo
        ? toolByNo.get(line.toolOrGaugeNo.trim())
        : undefined;

      return {
        rowId: line.rowId,
        reqNo: line.reqNo,
        reqDate: header?.reqDate?.toISOString() ?? line.creatDt?.toISOString() ?? null,
        deptId: header?.deptId ?? null,
        empCd: header?.empCd ?? null,
        headerStatus: header?.status ?? null,
        matType: line.matType ?? header?.matType ?? null,
        fromWhere: header?.fromWhere ?? null,
        toolOrGaugeNo: line.toolOrGaugeNo,
        toolName: tool?.name ?? null,
        grouping: tool?.grouping ?? null,
        description: line.descrip,
        machine: line.machine ?? line.mcNo,
        reqQty,
        issueQty,
        balanceQty: Math.max(0, reqQty - issueQty),
        uom: line.uom,
        lineStatus: line.status,
        remarks: line.remarks,
        creatUserIdCd: line.creatUserIdCd ?? header?.creatUserIdCd ?? "",
        pending,
      };
    });

    const filtered =
      statusFilter === "all"
        ? mapped
        : statusFilter === "fulfilled"
          ? mapped.filter((r) => !r.pending)
          : mapped.filter((r) => r.pending);

    const total = filtered.length;
    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    const pendingCount = mapped.filter((r) => r.pending).length;
    const fulfilledCount = mapped.length - pendingCount;
    const uniqueReqs = new Set(mapped.filter((r) => r.pending).map((r) => r.reqNo)).size;

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      pendingCount,
      fulfilledCount,
      uniquePendingReqs: uniqueReqs,
      toolLineCount: mapped.length,
      mode: "requisition",
      source: "MATERIAL_REQUISITION_MASTER / MATERIAL_REQUISITION_TRANS",
    });
  } catch (error) {
    console.error("GET /api/requisition-pending failed:", error);
    return NextResponse.json(
      {
        items: [],
        total: 0,
        page: 1,
        pageSize,
        pendingCount: 0,
        fulfilledCount: 0,
        uniquePendingReqs: 0,
        toolLineCount: 0,
        error: error instanceof Error ? error.message : "Failed to load requisitions",
      },
      { status: 500 }
    );
  }
}

/**
 * POST — raise a tools Material Requisition (ERP MATERIAL_REQUISITION_*).
 * Creates OPEN header + lines with TOOL_GAUGE_NO so they appear on Pending / Issue.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  // Closest existing flag until dedicated requisition permission exists
  const permCheck = await requirePermission(authCheck.session, "canCreateIssue");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = MaterialRequisitionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const matType = (data.matType?.trim() || "TOOLS").slice(0, 20);
  const reqDate = data.reqDate ? new Date(data.reqDate) : new Date();

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const created = await prisma.$transaction(async (tx) => {
      // Validate tools exist
      for (const line of data.lines) {
        const toolNo = line.toolOrGaugeNo.trim();
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: toolNo },
          select: { toolOrGaugeNo: true, name: true, uom: true, description: true },
        });
        if (!tool) {
          throw new Error(`Tool not found: ${toolNo}`);
        }
      }

      const reqNo = await generateMrsReqNo(tx);

      // ROW_ID is identity/autoincrement — omit so SQL Server insert works
      const header = await tx.materialRequisitionMaster.create({
        data: {
          reqNo,
          deptId: data.deptId ?? null,
          empCd: data.empCd ?? null,
          reqDate,
          status: "OPEN",
          matType,
          fromWhere: data.fromWhere?.trim().slice(0, 30) || "TOOLS_APP",
          issueQty: 0,
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });

      const lines = [];
      for (const line of data.lines) {
        const toolNo = line.toolOrGaugeNo.trim();
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: toolNo },
          select: { name: true, uom: true, description: true },
        });
        const createdLine = await tx.materialRequisitionTrans.create({
          data: {
            refRowId: header.rowId,
            reqNo,
            toolOrGaugeNo: toolNo.slice(0, 30),
            reqQty: line.reqQty,
            issueQty: 0,
            uom: (line.uom || tool?.uom || "").slice(0, 20) || null,
            machine: line.machine?.trim().slice(0, 20) || null,
            descrip: (
              line.description ||
              tool?.description ||
              tool?.name ||
              toolNo
            ).slice(0, 500),
            remarks: (line.remarks || data.remarks || "").slice(0, 500) || null,
            matType,
            status: "OPEN",
            creatUserIdCd: erpActor,
            creatDt: new Date(),
          },
        });
        lines.push(createdLine);
      }

      return { header, lines, reqNo };
    });

    return NextResponse.json(
      {
        ok: true,
        reqNo: created.reqNo,
        header: created.header,
        lineCount: created.lines.length,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to raise requisition";
    console.error("POST /api/requisition-pending failed:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
