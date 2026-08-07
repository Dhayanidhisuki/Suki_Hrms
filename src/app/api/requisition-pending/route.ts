import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

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
  if (opts.issueQty <= 0) return true;
  if (opts.reqQty > 0 && opts.issueQty < opts.reqQty) return true;
  return isPendingStatus(opts.lineStatus) || isPendingStatus(opts.headerStatus);
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
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));

  try {
    const toolLineWhere: Prisma.MaterialRequisitionTransWhereInput = {
      AND: [
        { toolOrGaugeNo: { not: null } },
        { NOT: { toolOrGaugeNo: "" } },
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

    const lines = await prisma.materialRequisitionTrans.findMany({
      where: toolLineWhere,
      orderBy: [{ creatDt: "desc" }, { rowId: "desc" }],
      take: 500,
    });

    const reqNos = [
      ...new Set(lines.map((l) => l.reqNo).filter((n): n is string => Boolean(n))),
    ];

    const headers =
      reqNos.length > 0
        ? await prisma.materialRequisitionMaster.findMany({
            where: { reqNo: { in: reqNos } },
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

    const mapped = lines.map((line) => {
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
        creatUserIdCd: line.creatUserIdCd,
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
